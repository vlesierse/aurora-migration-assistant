using System.Collections.Concurrent;
using System.Data;
using System.Data.SqlClient;
using System.Diagnostics;

namespace MigrationAssistant.Functions.QueryExecutor;

public class SqlServerClient : IDisposable
{
    private readonly string _connectionString;
    private readonly ConcurrentDictionary<int, SqlConnection> _connections = new();
    
    public SqlServerClient(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<StatementResult> ExecuteStatement(int sessionId, string statement)
    {
        var connection = _connections.GetOrAdd(sessionId, _ => new SqlConnection(_connectionString));
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        using var command = new SqlCommand(statement, connection);
        var now = DateTime.UtcNow;
        var stopwatch = Stopwatch.StartNew();
        try
        {
            await command.ExecuteNonQueryAsync();
            stopwatch.Stop();
            return StatementResult.Success(stopwatch.ElapsedMilliseconds, now);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return StatementResult.Failed(stopwatch.ElapsedMilliseconds, now, ex.Message);
        }
    }

    public Task CloseConnections => Task.WhenAll(_connections.Values.Select(c => c.CloseAsync()));

    public void Dispose()
    {
        foreach (var connection in _connections.Values)
        {
            connection.Dispose();
        }
    }
}