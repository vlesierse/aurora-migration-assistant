namespace MigrationAssistant.Shared.Records;

public class StatementRecord
{
    public Guid TestsetId { get; set; }
    public Guid StatementId { get; set; }
    public UInt16 SessionId { get; set; }
    public string? Statement { get; set; } 
}
