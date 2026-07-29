export const ORGANIZATION_VERIFICATION_LAYER_DEPENDENCIES = Object.freeze([
  Object.freeze({
    layer: "organization_verification_domain",
    dependsOn: Object.freeze(["organization_registry"]),
  }),
  Object.freeze({
    layer: "workflow_contract",
    dependsOn: Object.freeze([
      "organization_verification_domain",
      "attempt_lifecycle_contract",
    ]),
  }),
  Object.freeze({
    layer: "workflow_runtime",
    dependsOn: Object.freeze([
      "workflow_contract",
      "attempt_lifecycle_runtime",
      "frozen_authorities",
    ]),
  }),
  Object.freeze({
    layer: "persistence_contract",
    dependsOn: Object.freeze([
      "workflow_contract",
      "attempt_lifecycle_contract",
      "frozen_authorities",
    ]),
  }),
  Object.freeze({
    layer: "persistence_adapter",
    dependsOn: Object.freeze(["persistence_contract"]),
  }),
  Object.freeze({
    layer: "replay_runtime",
    dependsOn: Object.freeze([
      "persistence_contract",
      "workflow_contract",
      "attempt_lifecycle_contract",
    ]),
  }),
  Object.freeze({
    layer: "application_service_contract",
    dependsOn: Object.freeze([
      "persistence_contract",
      "replay_runtime",
      "workflow_runtime",
      "workflow_contract",
      "frozen_authorities",
    ]),
  }),
  Object.freeze({
    layer: "cross_layer_conformance",
    dependsOn: Object.freeze([
      "application_service_contract",
      "persistence_contract",
      "replay_runtime",
      "workflow_runtime",
      "workflow_contract",
    ]),
  }),
  Object.freeze({
    layer: "application_service_runtime",
    dependsOn: Object.freeze([
      "application_service_contract",
      "persistence_contract",
      "replay_runtime",
      "workflow_runtime",
    ]),
  }),
  Object.freeze({
    layer: "future_delivery_layer",
    dependsOn: Object.freeze(["application_service_contract"]),
  }),
] as const);

export const ORGANIZATION_VERIFICATION_FORBIDDEN_CROSS_LAYER_DEPENDENCIES =
  Object.freeze([
    Object.freeze({
      layer: "organization_verification_domain",
      forbidden: Object.freeze([
        "workflow_runtime",
        "persistence_contract",
        "persistence_adapter",
        "replay_runtime",
        "application_service_contract",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      layer: "workflow_runtime",
      forbidden: Object.freeze([
        "persistence_adapter",
        "replay_runtime",
        "application_service_contract",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      layer: "persistence_contract",
      forbidden: Object.freeze([
        "persistence_adapter",
        "replay_runtime",
        "application_service_contract",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      layer: "replay_runtime",
      forbidden: Object.freeze([
        "persistence_adapter",
        "application_service_contract",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      layer: "application_service_contract",
      forbidden: Object.freeze([
        "persistence_adapter",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      layer: "future_delivery_layer",
      forbidden: Object.freeze([
        "persistence_contract",
        "persistence_adapter",
        "replay_runtime",
        "workflow_runtime",
      ]),
    }),
  ] as const);
