using System.Text.Json;
using Microsoft.EntityFrameworkCore;

public class NotificationWorker(
    IServiceScopeFactory scopes,
    IHttpClientFactory clients,
    IConfiguration config,
    ILogger<NotificationWorker> log
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDb>();
                var now = DateTime.UtcNow;
                var upcoming = await db
                    .Lessons.Where(x =>
                        !x.Done && x.StartsAt > now && x.StartsAt <= now.AddMinutes(60)
                    )
                    .ToListAsync(stoppingToken);
                foreach (var l in upcoming)
                {
                    var text =
                        $"Скоро занятие: {l.Title}. {l.StartsAt.AddHours(5):dd.MM.yyyy HH:mm} (Екатеринбург)";
                    if (
                        !await db.Notifications.AnyAsync(
                            x => x.StudentId == l.StudentId && x.Text == text,
                            stoppingToken
                        )
                    )
                        db.Notifications.Add(
                            new Notification { StudentId = l.StudentId, Text = text }
                        );
                }
                await db.SaveChangesAsync(stoppingToken);
                var telegramConfigured = !string.IsNullOrEmpty(config["TELEGRAM_BOT_TOKEN"]);
                var vkConfigured = !string.IsNullOrEmpty(config["VK_BOT_TOKEN"]);
                var enabledStudents = db
                    .Users.Where(u =>
                        (telegramConfigured && u.TelegramChatId != null && u.TelegramChatId != "")
                        || (vkConfigured && u.VkPeerId != null && u.VkPeerId != "")
                    )
                    .Select(u => u.Id);
                var items = await db
                    .Notifications.Where(x =>
                        x.State == "Pending"
                        && x.Attempts < 5
                        && enabledStudents.Contains(x.StudentId)
                    )
                    .OrderBy(x => x.CreatedAt)
                    .Take(20)
                    .ToListAsync(stoppingToken);
                foreach (var n in items)
                {
                    var u = await db.Users.FindAsync([n.StudentId], stoppingToken);
                    if (u is null)
                        continue;
                    var attempted = false;
                    if (
                        n.TelegramState == "Pending"
                        && !string.IsNullOrEmpty(config["TELEGRAM_BOT_TOKEN"])
                        && !string.IsNullOrEmpty(u.TelegramChatId)
                    )
                    {
                        attempted = true;
                        try
                        {
                            using var r = await clients
                                .CreateClient()
                                .PostAsJsonAsync(
                                    $"https://api.telegram.org/bot{config["TELEGRAM_BOT_TOKEN"]}/sendMessage",
                                    new { chat_id = u.TelegramChatId, text = n.Text },
                                    stoppingToken
                                );
                            using var j = JsonDocument.Parse(
                                await r.Content.ReadAsStringAsync(stoppingToken)
                            );
                            if (
                                r.IsSuccessStatusCode
                                && j.RootElement.GetProperty("ok").GetBoolean()
                            )
                                n.TelegramState = "Sent";
                        }
                        catch (Exception)
                        {
                            log.LogWarning("Telegram notification failed: {Id}", n.Id);
                        }
                    }
                    if (
                        n.VkState == "Pending"
                        && !string.IsNullOrEmpty(config["VK_BOT_TOKEN"])
                        && !string.IsNullOrEmpty(u.VkPeerId)
                    )
                    {
                        attempted = true;
                        try
                        {
                            var fields = new Dictionary<string, string>
                            {
                                { "access_token", config["VK_BOT_TOKEN"]! },
                                { "v", "5.199" },
                                { "peer_id", u.VkPeerId },
                                {
                                    "random_id",
                                    (
                                        BitConverter.ToUInt32(n.Id.ToByteArray(), 0) & 0x7fffffff
                                    ).ToString()
                                },
                                { "message", n.Text },
                            };
                            using var r = await clients
                                .CreateClient()
                                .PostAsync(
                                    "https://api.vk.com/method/messages.send",
                                    new FormUrlEncodedContent(fields),
                                    stoppingToken
                                );
                            using var j = JsonDocument.Parse(
                                await r.Content.ReadAsStringAsync(stoppingToken)
                            );
                            if (
                                r.IsSuccessStatusCode
                                && j.RootElement.TryGetProperty("response", out _)
                            )
                                n.VkState = "Sent";
                        }
                        catch (Exception)
                        {
                            log.LogWarning("VK notification failed: {Id}", n.Id);
                        }
                    }
                    if (attempted)
                        n.Attempts++;
                    var tgEnabled =
                        !string.IsNullOrEmpty(config["TELEGRAM_BOT_TOKEN"])
                        && !string.IsNullOrEmpty(u.TelegramChatId);
                    var vkEnabled =
                        !string.IsNullOrEmpty(config["VK_BOT_TOKEN"])
                        && !string.IsNullOrEmpty(u.VkPeerId);
                    if (
                        (tgEnabled || vkEnabled)
                        && (!tgEnabled || n.TelegramState == "Sent")
                        && (!vkEnabled || n.VkState == "Sent")
                    )
                        n.State = "Sent";
                    else if (n.Attempts >= 5)
                        n.State = "Failed";
                    await db.SaveChangesAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception)
            {
                log.LogError("Notification worker iteration failed");
            }
        }
    }
}
