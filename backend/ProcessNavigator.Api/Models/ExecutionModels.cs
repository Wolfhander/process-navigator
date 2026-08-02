namespace ProcessNavigator.Api.Models;

public sealed record StepExecutionModel(string ElementId, string Status, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, string? UserId);
public sealed record ProcessInstanceModel(string Id, string ProcessId, string ProcessVersion, string Name, string Status,
    DateTimeOffset StartedAt, DateTimeOffset? CompletedAt, string StartedBy, IReadOnlyList<StepExecutionModel> Steps);
public sealed record StartProcessInstanceModel(string? Name);
public sealed record StepStatusUpdateModel(string Status);
