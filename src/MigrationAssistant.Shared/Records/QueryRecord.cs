namespace MigrationAssistant.Shared.Records;

public class QueryRecord
{
    public Guid TestsetId { get; set; }
    public Guid QueryId { get; set; }
    public int SessionId { get; set; }
    public string QueryText { get; set; } 
}
