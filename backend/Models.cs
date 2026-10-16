using Microsoft.EntityFrameworkCore;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "Student";
    public string Grade { get; set; } = "";
    public string? TelegramChatId { get; set; }
    public string? VkPeerId { get; set; }
}

public class Lesson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public string Title { get; set; } = "";
    public DateTime StartsAt { get; set; }
    public int Minutes { get; set; } = 60;
    public decimal Price { get; set; }
    public bool Done { get; set; }
    public bool Paid { get; set; }
}

public class Material
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string Section { get; set; } = "";
    public string Kind { get; set; } = "Урок";
    public string Content { get; set; } = "";
    public string Answer { get; set; } = "";
}

public class Assignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid MaterialId { get; set; }
    public DateTime Deadline { get; set; }
    public string Response { get; set; } = "";
    public string Status { get; set; } = "Назначено";
    public string Feedback { get; set; } = "";
}

public class StoredFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MaterialId { get; set; }
    public string Name { get; set; } = "";
    public string Extension { get; set; } = "";
    public string ContentType { get; set; } = "";
}

public class Board
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public string Data { get; set; } = "[]";
    public int Version { get; set; }
}

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string State { get; set; } = "Pending";
    public int Attempts { get; set; }
    public string TelegramState { get; set; } = "Pending";
    public string VkState { get; set; } = "Pending";
}

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<StoredFile> Files => Set<StoredFile>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Board>().HasIndex(x => x.LessonId).IsUnique();
        b.Entity<Board>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<Lesson>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.StudentId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Assignment>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.StudentId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Assignment>()
            .HasOne<Material>()
            .WithMany()
            .HasForeignKey(x => x.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<StoredFile>()
            .HasOne<Material>()
            .WithMany()
            .HasForeignKey(x => x.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Board>()
            .HasOne<Lesson>()
            .WithMany()
            .HasForeignKey(x => x.LessonId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public record LoginInput(string Email, string Password);

public record StudentInput(
    string Name,
    string Email,
    string Grade,
    string Password,
    string? TelegramChatId,
    string? VkPeerId
);

public record LessonInput(
    Guid StudentId,
    string Title,
    DateTimeOffset StartsAt,
    int Minutes,
    decimal Price,
    bool Done,
    bool Paid
);

public record MaterialInput(
    string Title,
    string Section,
    string Kind,
    string Content,
    string Answer
);

public record AssignmentInput(Guid StudentId, Guid MaterialId, DateTimeOffset Deadline);

public record SubmitInput(string Response);

public record ReviewInput(string Status, string Feedback);

public record BoardInput(string Data, int Version);
