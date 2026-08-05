namespace ProcessNavigator.Api.Models;

public sealed record OrganizationMapModel(
    string Id,
    string Name,
    string Description,
    IReadOnlyList<LegalEntityModel> LegalEntities,
    IReadOnlyList<CrossCompanyProcessModel> CrossCompanyProcesses);

public sealed record LegalEntityModel(
    string Id,
    string Name,
    string Description,
    IReadOnlyList<BusinessDirectionModel> Directions,
    IReadOnlyList<OrganizationUnitModel>? Units = null);

public sealed record OrganizationUnitModel(
    string Id,
    string? ParentId,
    string Name,
    string ShortName,
    string ManagerPosition);

public sealed record BusinessDirectionModel(
    string Id,
    string Name,
    string Description,
    string Icon,
    IReadOnlyList<string> ProcessIds);

public sealed record CrossCompanyProcessModel(
    string ProcessId,
    IReadOnlyList<string> LegalEntityIds,
    IReadOnlyList<LaneOrganizationModel> LaneOrganizations,
    string Description);

public sealed record LaneOrganizationModel(
    string LaneId,
    string LegalEntityId,
    string Department);
