"""Builders for the genetics tests. All people and findings here are synthetic."""

from __future__ import annotations

from bayan.core.contracts import Finding, Inheritance, PersonReport, Sex, Zygosity

FULL = "uae_demo_panel_v1"
HAEM = "haemoglobinopathy_demo_panel_v1"

AR = Inheritance.AUTOSOMAL_RECESSIVE
XL = Inheritance.X_LINKED
AD = Inheritance.AUTOSOMAL_DOMINANT

GENES = {
    "beta_thalassaemia": "HBB",
    "sickle_cell_disease": "HBB",
    "hbb_compound_haemoglobin_disorder": "HBB",
    "hb_variant_other": "HBB",
    "alpha_thalassaemia_alpha0": "HBA1/HBA2",
    "cystic_fibrosis": "CFTR",
    "congenital_adrenal_hyperplasia": "CYP21A2",
    "familial_mediterranean_fever": "MEFV",
    "usher_syndrome_type_2a": "USH2A",
    "stargardt_disease": "ABCA4",
    "g6pd_deficiency": "G6PD",
    "neurofibromatosis_type_1": "NF1",
}


def finding(
    condition_id: str,
    zygosity: Zygosity,
    *,
    inheritance: Inheritance | None = None,
    classification: str = "pathogenic",
) -> Finding:
    inh = inheritance or (XL if condition_id == "g6pd_deficiency" else AR)
    return Finding(
        gene=GENES[condition_id],
        condition_id=condition_id,
        zygosity=zygosity,
        inheritance=inh,
        classification=classification,  # type: ignore[arg-type]
    )


def carrier(condition_id: str) -> Finding:
    return finding(condition_id, Zygosity.CARRIER)


def affected(condition_id: str) -> Finding:
    return finding(condition_id, Zygosity.AFFECTED)


def vus(condition_id: str) -> Finding:
    return finding(condition_id, Zygosity.VUS, classification="vus")


def person(
    person_id: str,
    sex: Sex,
    *findings: Finding,
    panel: str = FULL,
    status: str = "final",
    haem_stage: str = "genotype_confirmed",
) -> PersonReport:
    return PersonReport(
        person_id=person_id,
        sex=sex,
        panel_id=panel,
        findings=tuple(findings),
        status=status,  # type: ignore[arg-type]
        haem_stage=haem_stage,  # type: ignore[arg-type]
    )


def female(*findings: Finding, **kwargs: str) -> PersonReport:
    return person("P-F", Sex.FEMALE, *findings, **kwargs)


def male(*findings: Finding, **kwargs: str) -> PersonReport:
    return person("P-M", Sex.MALE, *findings, **kwargs)


def lines(result_shared: object) -> dict[str, int]:
    """Label to per_100 for one SharedCondition (any_child lines)."""
    return {o.label: o.per_100 for o in result_shared.outcomes}  # type: ignore[attr-defined]
