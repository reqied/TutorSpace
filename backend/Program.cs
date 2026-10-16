using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);
builder.Services.AddDbContext<AppDb>(o =>
    o.UseNpgsql(
        builder.Configuration.GetConnectionString("Default")
            ?? throw new Exception("ConnectionStrings__Default required")
    )
);
builder
    .Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/data/keys"))
    .SetApplicationName("TutorSpace");
builder
    .Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = "tutor_session";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        o.ExpireTimeSpan = TimeSpan.FromDays(7);
        o.Events.OnRedirectToLogin = c =>
        {
            c.Response.StatusCode = 401;
            return Task.CompletedTask;
        };
        o.Events.OnRedirectToAccessDenied = c =>
        {
            c.Response.StatusCode = 403;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization(o => o.AddPolicy("Tutor", p => p.RequireRole("Tutor")));
builder.Services.AddSignalR();
builder.Services.AddHttpClient();
builder.Services.AddHostedService<NotificationWorker>();
builder.Services.AddRateLimiter(o =>
    o.AddPolicy(
        "login",
        c =>
            RateLimitPartition.GetFixedWindowLimiter(
                c.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 12,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }
            )
    )
);
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 20 * 1024 * 1024
);
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    await db.Database.EnsureCreatedAsync();
    if (!await db.Users.AnyAsync(x => x.Role == "Tutor"))
    {
        var email =
            builder.Configuration["TUTOR_EMAIL"] ?? throw new Exception("TUTOR_EMAIL required");
        var password = builder.Configuration["TUTOR_PASSWORD"] ?? "";
        if (password.Length < 12)
            throw new Exception("TUTOR_PASSWORD must have at least 12 characters");
        var u = new User
        {
            Name = "Илона",
            Email = email.Trim().ToLowerInvariant(),
            Role = "Tutor",
        };
        u.PasswordHash = new PasswordHasher<User>().HashPassword(u, password);
        db.Users.Add(u);
        await db.SaveChangesAsync();
    }
}
app.Use(
    async (c, next) =>
    {
        if (c.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
        {
            var origin = c.Request.Headers.Origin.ToString();
            var allowed = builder.Configuration["PUBLIC_ORIGIN"];
            if (origin != "" && !string.Equals(origin, allowed, StringComparison.OrdinalIgnoreCase))
            {
                c.Response.StatusCode = 403;
                return;
            }
        }
        await next();
    }
);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet(
    "/api/health",
    async (AppDb db) =>
        await db.Database.CanConnectAsync()
            ? Results.Ok(new { status = "ok" })
            : Results.StatusCode(503)
);
app.MapPost(
        "/api/auth/login",
        async (LoginInput input, AppDb db, HttpContext c) =>
        {
            var u = await db.Users.SingleOrDefaultAsync(x =>
                x.Email == input.Email.Trim().ToLowerInvariant()
            );
            if (
                u is null
                || new PasswordHasher<User>().VerifyHashedPassword(
                    u,
                    u.PasswordHash,
                    input.Password
                ) == PasswordVerificationResult.Failed
            )
                return Results.Unauthorized();
            await c.SignInAsync(
                new ClaimsPrincipal(
                    new ClaimsIdentity(
                        [
                            new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
                            new Claim(ClaimTypes.Role, u.Role),
                            new Claim(ClaimTypes.Name, u.Name),
                        ],
                        CookieAuthenticationDefaults.AuthenticationScheme
                    )
                )
            );
            return Results.Ok(
                new
                {
                    u.Id,
                    u.Name,
                    u.Role,
                }
            );
        }
    )
    .RequireRateLimiting("login");
app.MapPost(
        "/api/auth/logout",
        async (HttpContext c) =>
        {
            await c.SignOutAsync();
            return Results.NoContent();
        }
    )
    .RequireAuthorization();
app.MapGet(
        "/api/auth/me",
        (ClaimsPrincipal u) =>
            Results.Ok(
                new
                {
                    id = Access.Id(u),
                    name = u.Identity!.Name,
                    role = u.FindFirstValue(ClaimTypes.Role),
                }
            )
    )
    .RequireAuthorization();
var api = app.MapGroup("/api").RequireAuthorization();
var tutor = api.MapGroup("").RequireAuthorization("Tutor");
api.MapGet(
    "/students",
    async (AppDb db, ClaimsPrincipal u) =>
        await db
            .Users.Where(x => x.Role == "Student" && (Access.Tutor(u) || x.Id == Access.Id(u)))
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Email,
                x.Grade,
                x.TelegramChatId,
                x.VkPeerId,
            })
            .ToListAsync()
);
tutor.MapPost(
    "/students",
    async (StudentInput i, AppDb db) =>
    {
        if (string.IsNullOrWhiteSpace(i.Name) || !i.Email.Contains('@') || i.Password.Length < 10)
            return Results.BadRequest(new { message = "Нужны имя, email и пароль от 10 символов" });
        var email = i.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email))
            return Results.Conflict(new { message = "Email уже занят" });
        var u = new User
        {
            Name = i.Name.Trim(),
            Email = email,
            Grade = i.Grade,
            TelegramChatId = i.TelegramChatId,
            VkPeerId = i.VkPeerId,
        };
        u.PasswordHash = new PasswordHasher<User>().HashPassword(u, i.Password);
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return Results.Ok(
            new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Grade,
            }
        );
    }
);
tutor.MapPut(
    "/students/{id:guid}",
    async (Guid id, StudentInput i, AppDb db) =>
    {
        var u = await db.Users.SingleOrDefaultAsync(x => x.Id == id && x.Role == "Student");
        if (u is null)
            return Results.NotFound();
        if (
            string.IsNullOrWhiteSpace(i.Name)
            || !i.Email.Contains('@')
            || (i.Password != "" && i.Password.Length < 10)
        )
            return Results.BadRequest();
        var email = i.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email && x.Id != id))
            return Results.Conflict(new { message = "Email уже занят" });
        u.Name = i.Name.Trim();
        u.Email = email;
        u.Grade = i.Grade;
        u.TelegramChatId = i.TelegramChatId;
        u.VkPeerId = i.VkPeerId;
        if (i.Password != "")
            u.PasswordHash = new PasswordHasher<User>().HashPassword(u, i.Password);
        await db.SaveChangesAsync();
        return Results.Ok(
            new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Grade,
            }
        );
    }
);
api.MapGet(
    "/lessons",
    async (AppDb db, ClaimsPrincipal u) =>
        await db
            .Lessons.Where(x => Access.Tutor(u) || x.StudentId == Access.Id(u))
            .OrderBy(x => x.StartsAt)
            .ToListAsync()
);
tutor.MapPost(
    "/lessons",
    async (LessonInput i, AppDb db) =>
    {
        if (
            !await Access.Student(db, i.StudentId)
            || i.Minutes < 1
            || i.Minutes > 480
            || i.Price < 0
            || string.IsNullOrWhiteSpace(i.Title)
        )
            return Results.BadRequest();
        var l = new Lesson
        {
            StudentId = i.StudentId,
            Title = i.Title,
            StartsAt = i.StartsAt.UtcDateTime,
            Minutes = i.Minutes,
            Price = i.Price,
        };
        db.Lessons.Add(l);
        db.Boards.Add(new Board { LessonId = l.Id });
        db.Notifications.Add(
            new Notification
            {
                StudentId = i.StudentId,
                Text =
                    $"Новое занятие: {i.Title}. {i.StartsAt.ToOffset(TimeSpan.FromHours(5)):dd.MM.yyyy HH:mm} (Екатеринбург)",
            }
        );
        await db.SaveChangesAsync();
        return Results.Ok(l);
    }
);
tutor.MapPatch(
    "/lessons/{id:guid}",
    async (Guid id, LessonInput i, AppDb db) =>
    {
        var l = await db.Lessons.FindAsync(id);
        if (l is null)
            return Results.NotFound();
        if (l.StudentId != i.StudentId)
            return Results.BadRequest(
                new
                {
                    message = "Нельзя менять ученика у существующего занятия. Создай новое занятие.",
                }
            );
        if (
            !await Access.Student(db, i.StudentId)
            || i.Minutes < 1
            || i.Minutes > 480
            || i.Price < 0
            || string.IsNullOrWhiteSpace(i.Title)
        )
            return Results.BadRequest();
        l.StudentId = i.StudentId;
        l.Title = i.Title;
        l.StartsAt = i.StartsAt.UtcDateTime;
        l.Minutes = i.Minutes;
        l.Price = i.Price;
        l.Done = i.Done;
        l.Paid = i.Paid;
        await db.SaveChangesAsync();
        return Results.Ok(l);
    }
);
api.MapGet(
    "/materials",
    async (AppDb db, ClaimsPrincipal u) =>
    {
        var ids = db.Assignments.Where(a => a.StudentId == Access.Id(u)).Select(a => a.MaterialId);
        var rows = await db
            .Materials.Where(x => Access.Tutor(u) || ids.Contains(x.Id))
            .ToListAsync();
        return Results.Ok(
            rows.Select(m => new
            {
                m.Id,
                m.Title,
                m.Section,
                m.Kind,
                m.Content,
                answer = Access.Tutor(u) ? m.Answer : null,
                autoCheck = m.Answer != "",
            })
        );
    }
);
tutor.MapPost(
    "/materials",
    async (MaterialInput i, AppDb db) =>
    {
        if (!Access.Valid(i))
            return Results.BadRequest();
        var m = new Material
        {
            Title = i.Title,
            Section = i.Section,
            Kind = i.Kind,
            Content = i.Content,
            Answer = i.Answer,
        };
        db.Materials.Add(m);
        await db.SaveChangesAsync();
        return Results.Ok(m);
    }
);
tutor.MapPut(
    "/materials/{id:guid}",
    async (Guid id, MaterialInput i, AppDb db) =>
    {
        var m = await db.Materials.FindAsync(id);
        if (m is null)
            return Results.NotFound();
        if (!Access.Valid(i))
            return Results.BadRequest();
        m.Title = i.Title;
        m.Section = i.Section;
        m.Kind = i.Kind;
        m.Content = i.Content;
        m.Answer = i.Answer;
        await db.SaveChangesAsync();
        return Results.Ok(m);
    }
);
api.MapGet(
    "/assignments",
    async (AppDb db, ClaimsPrincipal u) =>
        await db
            .Assignments.Where(x => Access.Tutor(u) || x.StudentId == Access.Id(u))
            .ToListAsync()
);
tutor.MapPost(
    "/assignments",
    async (AssignmentInput i, AppDb db) =>
    {
        if (
            !await Access.Student(db, i.StudentId)
            || !await db.Materials.AnyAsync(x => x.Id == i.MaterialId)
        )
            return Results.BadRequest();
        var a = new Assignment
        {
            StudentId = i.StudentId,
            MaterialId = i.MaterialId,
            Deadline = i.Deadline.UtcDateTime,
        };
        db.Assignments.Add(a);
        var title = await db
            .Materials.Where(x => x.Id == i.MaterialId)
            .Select(x => x.Title)
            .SingleAsync();
        db.Notifications.Add(
            new Notification
            {
                StudentId = i.StudentId,
                Text =
                    $"Назначен материал: {title}. Срок: {i.Deadline.ToOffset(TimeSpan.FromHours(5)):dd.MM.yyyy HH:mm}",
            }
        );
        await db.SaveChangesAsync();
        return Results.Ok(a);
    }
);
api.MapPost(
    "/assignments/{id:guid}/submit",
    async (Guid id, SubmitInput i, AppDb db, ClaimsPrincipal u) =>
    {
        var a = await db.Assignments.FindAsync(id);
        if (a is null)
            return Results.NotFound();
        if (a.StudentId != Access.Id(u))
            return Results.Forbid();
        if (i.Response.Length > 20000 || string.IsNullOrWhiteSpace(i.Response))
            return Results.BadRequest();
        var m = await db.Materials.FindAsync(a.MaterialId);
        a.Response = i.Response;
        a.Status =
            m!.Answer == "" ? "На проверке"
            : Access.Normalize(m.Answer) == Access.Normalize(i.Response) ? "Верно"
            : "Попробуй ещё";
        await db.SaveChangesAsync();
        return Results.Ok(a);
    }
);
tutor.MapPost(
    "/assignments/{id:guid}/review",
    async (Guid id, ReviewInput i, AppDb db) =>
    {
        var a = await db.Assignments.FindAsync(id);
        if (a is null)
            return Results.NotFound();
        if (i.Status is not ("Принято" or "На доработку"))
            return Results.BadRequest();
        a.Status = i.Status;
        a.Feedback = i.Feedback;
        db.Notifications.Add(
            new Notification
            {
                StudentId = a.StudentId,
                Text = $"Домашнее задание проверено: {i.Status}. {i.Feedback}",
            }
        );
        await db.SaveChangesAsync();
        return Results.Ok(a);
    }
);
api.MapGet(
    "/files",
    async (Guid materialId, AppDb db, ClaimsPrincipal u) =>
    {
        if (!await Access.Material(db, u, materialId))
            return Results.Forbid();
        return Results.Ok(await db.Files.Where(x => x.MaterialId == materialId).ToListAsync());
    }
);
tutor
    .MapPost(
        "/files/{materialId:guid}",
        async (Guid materialId, HttpRequest req, AppDb db) =>
        {
            if (!await db.Materials.AnyAsync(x => x.Id == materialId))
                return Results.NotFound();
            var file = (await req.ReadFormAsync()).Files.GetFile("file");
            if (file is null || file.Length == 0 || file.Length > 20 * 1024 * 1024)
                return Results.BadRequest(new { message = "Файл должен быть до 20 МБ" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var types = new Dictionary<string, string>
            {
                { ".pdf", "application/pdf" },
                { ".png", "image/png" },
                { ".jpg", "image/jpeg" },
                { ".jpeg", "image/jpeg" },
                { ".webp", "image/webp" },
                {
                    ".pptx",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                },
                {
                    ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                },
                { ".txt", "text/plain" },
            };
            if (!types.TryGetValue(ext, out var mime))
                return Results.BadRequest(
                    new { message = "Разрешены PDF, изображения, PPTX, DOCX, TXT" }
                );
            var f = new StoredFile
            {
                MaterialId = materialId,
                Name = Path.GetFileName(file.FileName),
                Extension = ext,
                ContentType = mime,
            };
            Directory.CreateDirectory("/data/files");
            await using (var stream = File.Create($"/data/files/{f.Id}"))
                await file.CopyToAsync(stream);
            db.Files.Add(f);
            try
            {
                await db.SaveChangesAsync();
            }
            catch
            {
                File.Delete($"/data/files/{f.Id}");
                throw;
            }
            return Results.Ok(f);
        }
    )
    .DisableAntiforgery();
api.MapGet(
    "/files/{id:guid}",
    async (Guid id, AppDb db, ClaimsPrincipal u, HttpResponse res) =>
    {
        var f = await db.Files.FindAsync(id);
        if (f is null)
            return Results.NotFound();
        if (!await Access.Material(db, u, f.MaterialId))
            return Results.Forbid();
        res.Headers.XContentTypeOptions = "nosniff";
        res.Headers.ContentSecurityPolicy = "sandbox";
        var inline = f.Extension is ".pdf" or ".png" or ".jpg" or ".jpeg" or ".webp";
        return Results.File(
            $"/data/files/{f.Id}",
            f.ContentType,
            inline ? null : f.Name,
            enableRangeProcessing: true
        );
    }
);
api.MapGet(
    "/boards/{lessonId:guid}",
    async (Guid lessonId, AppDb db, ClaimsPrincipal u) =>
    {
        if (!await Access.Lesson(db, u, lessonId))
            return Results.Forbid();
        return Results.Ok(await db.Boards.SingleAsync(x => x.LessonId == lessonId));
    }
);
api.MapPut(
    "/boards/{lessonId:guid}",
    async (Guid lessonId, BoardInput i, AppDb db, ClaimsPrincipal u, IHubContext<BoardHub> hub) =>
    {
        if (!await Access.Lesson(db, u, lessonId))
            return Results.Forbid();
        if (i.Data.Length > 2000000)
            return Results.BadRequest();
        try
        {
            using var parsed = System.Text.Json.JsonDocument.Parse(i.Data);
            if (parsed.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array)
                return Results.BadRequest();
        }
        catch
        {
            return Results.BadRequest();
        }
        var b = await db.Boards.SingleAsync(x => x.LessonId == lessonId);
        if (b.Version != i.Version)
            return Results.Conflict(
                new { message = "Доска обновилась. Загрузи актуальную версию." }
            );
        b.Data = i.Data;
        b.Version++;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict();
        }
        await hub.Clients.Group(lessonId.ToString()).SendAsync("BoardUpdated", b);
        return Results.Ok(b);
    }
);
tutor.MapGet(
    "/notifications",
    async (AppDb db) =>
        await db.Notifications.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync()
);
app.MapHub<BoardHub>("/hubs/board").RequireAuthorization();
app.Run();

public static class Access
{
    public static Guid Id(ClaimsPrincipal u) =>
        Guid.Parse(u.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static bool Tutor(ClaimsPrincipal u) => u.IsInRole("Tutor");

    public static Task<bool> Student(AppDb d, Guid id) =>
        d.Users.AnyAsync(x => x.Id == id && x.Role == "Student");

    public static bool Valid(MaterialInput i) =>
        !string.IsNullOrWhiteSpace(i.Title)
        && !string.IsNullOrWhiteSpace(i.Section)
        && i.Kind is "Урок" or "Домашка"
        && i.Content.Length <= 100000;

    public static string Normalize(string s) => s.Trim().ToUpperInvariant().Replace(',', '.');

    public static async Task<bool> Material(AppDb d, ClaimsPrincipal u, Guid id) =>
        Tutor(u) || await d.Assignments.AnyAsync(x => x.MaterialId == id && x.StudentId == Id(u));

    public static async Task<bool> Lesson(AppDb d, ClaimsPrincipal u, Guid id) =>
        await d.Lessons.AnyAsync(x => x.Id == id && (Tutor(u) || x.StudentId == Id(u)));
}

[Microsoft.AspNetCore.Authorization.Authorize]
public class BoardHub(AppDb db) : Hub
{
    public async Task Join(Guid lessonId)
    {
        if (!await Access.Lesson(db, Context.User!, lessonId))
            throw new HubException("Forbidden");
        await Groups.AddToGroupAsync(Context.ConnectionId, lessonId.ToString());
    }

    public Task Leave(Guid lessonId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, lessonId.ToString());
}
