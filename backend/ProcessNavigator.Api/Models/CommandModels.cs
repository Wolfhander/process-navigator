namespace ProcessNavigator.Api.Models;

public sealed record ExecuteCommandRequestModel(string? InstanceId);

public sealed record CommandExecutionModel(
    string Id,
    string ProcessId,
    string ElementId,
    string ActionId,
    string ActionLabel,
    string Kind,
    string? Target,
    string? InstanceId,
    string UserId,
    string Status,
    string Message,
    string? ExternalReference,
    DateTimeOffset ExecutedAt);
