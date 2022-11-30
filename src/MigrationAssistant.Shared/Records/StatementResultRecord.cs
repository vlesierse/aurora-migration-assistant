namespace MigrationAssistant.Shared.Records;

public class StatementResultRecord : StatementRecord
{
    public StatementResultRecord(StatementRecord statementRecord)
    {
        TestsetId = statementRecord.TestsetId;
        SessionId = statementRecord.SessionId;
        Statement = statementRecord.Statement;
        StatementId = statementRecord.StatementId;
    }

    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public long Duration { get; set; }
    public DateTime ExecutionTime { get; set; }
    public string? DatabaseEngine { get; set; }
}
