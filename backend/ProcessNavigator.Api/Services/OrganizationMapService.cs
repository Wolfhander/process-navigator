using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class OrganizationMapService(IWebHostEnvironment environment)
{
    private readonly string path = Path.Combine(environment.ContentRootPath, "Data", "organization.json");
    private readonly SemaphoreSlim writeLock = new(1, 1);
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

    public async Task<OrganizationMapModel> SaveAsync(OrganizationMapModel model, CancellationToken cancellationToken = default)
    {
        Validate(model);
        await writeLock.WaitAsync(cancellationToken);
        string? temporaryPath = null;
        try
        {
            temporaryPath = Path.Combine(Path.GetDirectoryName(path)!, $".organization-{Guid.NewGuid():N}.tmp");
            await File.WriteAllTextAsync(temporaryPath, JsonSerializer.Serialize(model, new JsonSerializerOptions(JsonOptions) { WriteIndented = true }), cancellationToken);
            File.Move(temporaryPath, path, overwrite: true);
            temporaryPath = null;
            return model;
        }
        finally
        {
            if (temporaryPath is not null) File.Delete(temporaryPath);
            writeLock.Release();
        }
    }

    private static void Validate(OrganizationMapModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Id) || string.IsNullOrWhiteSpace(model.Name))
            throw new InvalidDataException("Organization group ID and name are required.");
        if (model.LegalEntities.Count == 0) throw new InvalidDataException("At least one legal entity is required.");
        if (model.LegalEntities.Count > 50) throw new InvalidDataException("An organization group cannot contain more than 50 legal entities.");
        if (model.LegalEntities.Select(item => item.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != model.LegalEntities.Count)
            throw new InvalidDataException("Legal entity IDs must be unique.");
        var entityIds = model.LegalEntities.Select(item => item.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var entity in model.LegalEntities)
        {
            if (string.IsNullOrWhiteSpace(entity.Id) || string.IsNullOrWhiteSpace(entity.Name)) throw new InvalidDataException("Legal entity ID and name are required.");
            if (entity.Directions.Count > 50) throw new InvalidDataException($"Legal entity '{entity.Name}' has too many directions.");
            if (entity.Directions.Select(item => item.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != entity.Directions.Count)
                throw new InvalidDataException($"Direction IDs must be unique within '{entity.Name}'.");
            if (entity.Directions.Any(item => string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Name)))
                throw new InvalidDataException($"Every direction in '{entity.Name}' must have an ID and name.");
            ValidateUnits(entity);
        }
        foreach (var process in model.CrossCompanyProcesses)
        {
            if (process.LegalEntityIds.Count < 2 || process.LegalEntityIds.Any(id => !entityIds.Contains(id)))
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' has invalid participants.");
            if (process.LaneOrganizations.Any(item => !process.LegalEntityIds.Contains(item.LegalEntityId, StringComparer.OrdinalIgnoreCase)))
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' maps a lane to a non-participating legal entity.");
            foreach (var mapping in process.LaneOrganizations.Where(item => item.UnitId is not null))
            {
                var entity = model.LegalEntities.First(item => item.Id.Equals(mapping.LegalEntityId, StringComparison.OrdinalIgnoreCase));
                if (!(entity.Units ?? []).Any(unit => unit.Id.Equals(mapping.UnitId, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidDataException($"Lane '{mapping.LaneId}' references an unknown organization unit.");
            }
            if (process.LaneOrganizations.Select(item => item.LaneId).Distinct(StringComparer.Ordinal).Count() != process.LaneOrganizations.Count)
                throw new InvalidDataException($"Cross-company process '{process.ProcessId}' maps the same lane more than once.");
        }
    }

    private static void ValidateUnits(LegalEntityModel entity)
    {
        var units = entity.Units ?? [];
        if (units.Count > 500) throw new InvalidDataException($"Legal entity '{entity.Name}' has too many organization units.");
        if (units.Select(item => item.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != units.Count)
            throw new InvalidDataException($"Organization unit IDs must be unique within '{entity.Name}'.");
        var ids = units.Select(item => item.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var unit in units)
        {
            if (string.IsNullOrWhiteSpace(unit.Id) || string.IsNullOrWhiteSpace(unit.Name))
                throw new InvalidDataException($"Every organization unit in '{entity.Name}' must have an ID and name.");
            if (unit.ParentId is not null && (!ids.Contains(unit.ParentId) || unit.ParentId.Equals(unit.Id, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidDataException($"Organization unit '{unit.Name}' has an invalid parent.");
            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { unit.Id };
            var parentId = unit.ParentId;
            while (parentId is not null)
            {
                if (!visited.Add(parentId)) throw new InvalidDataException($"Organization hierarchy in '{entity.Name}' contains a cycle.");
                parentId = units.First(item => item.Id.Equals(parentId, StringComparison.OrdinalIgnoreCase)).ParentId;
            }
        }
    }
}
