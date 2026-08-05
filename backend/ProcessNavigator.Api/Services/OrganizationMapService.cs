using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class OrganizationMapService(IWebHostEnvironment environment)
{
    private readonly string path = Path.Combine(environment.ContentRootPath, "Data", "organization.json");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<OrganizationMapModel> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("Organization map configuration was not found.", path);
        await using var stream = File.OpenRead(path);
        var model = await JsonSerializer.DeserializeAsync<OrganizationMapModel>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Organization map configuration is empty.");
        Validate(model);
        return model;
    }

    private static void Validate(OrganizationMapModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Id) || string.IsNullOrWhiteSpace(model.Name))
            throw new InvalidDataException("Organization group ID and name are required.");
        if (model.LegalEntities.Count == 0) throw new InvalidDataException("At least one legal entity is required.");
        if (model.LegalEntities.Select(item => item.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != model.LegalEntities.Count)
            throw new InvalidDataException("Legal entity IDs must be unique.");
        var entityIds = model.LegalEntities.Select(item => item.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var process in model.CrossCompanyProcesses)
        {
            if (process.LegalEntityIds.Count < 2 || process.LegalEntityIds.Any(id => !entityIds.Contains(id)))
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' has invalid participants.");
            if (process.LaneOrganizations.Any(item => !process.LegalEntityIds.Contains(item.LegalEntityId, StringComparer.OrdinalIgnoreCase)))
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' maps a lane to a non-participating legal entity.");
            if (process.LaneOrganizations.Select(item => item.LaneId).Distinct(StringComparer.Ordinal).Count() != process.LaneOrganizations.Count)
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' maps the same lane more than once.");
        }
    }
}
