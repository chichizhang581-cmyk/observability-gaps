using System;
using System.Diagnostics;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

public sealed class OrderSenderFixture
{
    private readonly HttpClient _httpClient = new();
    private readonly dynamic _logger = default!;
    private readonly dynamic _sender = default!;
    private readonly dynamic _dbContext = default!;

    public async Task SendOrderAsync(string orderId, int attempt, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/orders");
            using var response = await _httpClient.SendAsync(request, timeout.Token);
            _logger.LogInformation(
                "Order {OrderId} returned {StatusCode} on attempt {Attempt} after {ElapsedMilliseconds} ms",
                orderId, response.StatusCode, attempt, stopwatch.ElapsedMilliseconds);
            await _sender.SendMessageAsync(CreateMessage(orderId), cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            _logger.LogError(exception, "Order {OrderId} failed on attempt {Attempt}", orderId, attempt);
            throw;
        }
    }

    private static object CreateMessage(string orderId) => new { OrderId = orderId };
}
