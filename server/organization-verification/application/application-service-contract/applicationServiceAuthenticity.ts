const authenticApplicationRequests = new WeakSet<object>();
const authenticApplicationExecutions = new WeakSet<object>();
const authenticApplicationResults = new WeakSet<object>();

const applicationRequestSeal = Symbol(
  "organization-verification-application-request",
);
const applicationExecutionSeal = Symbol(
  "organization-verification-application-execution",
);
const applicationResultSeal = Symbol(
  "organization-verification-application-result",
);

function seal<T extends object>(
  value: T,
  authenticitySet: WeakSet<object>,
  authenticitySeal: symbol,
): Readonly<T> {
  Object.defineProperty(value, authenticitySeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  authenticitySet.add(value);
  return Object.freeze(value);
}

function isSealed(
  value: unknown,
  authenticitySet: WeakSet<object>,
  authenticitySeal: symbol,
): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticitySet.has(value) &&
    Object.getOwnPropertyDescriptor(value, authenticitySeal)?.value === true &&
    Object.isFrozen(value)
  );
}

export function sealApplicationRequestInternal<T extends object>(
  value: T,
): Readonly<T> {
  return seal(value, authenticApplicationRequests, applicationRequestSeal);
}

export function isApplicationRequestAuthenticInternal(
  value: unknown,
): value is object {
  return isSealed(
    value,
    authenticApplicationRequests,
    applicationRequestSeal,
  );
}

export function sealApplicationExecutionInternal<T extends object>(
  value: T,
): Readonly<T> {
  return seal(
    value,
    authenticApplicationExecutions,
    applicationExecutionSeal,
  );
}

export function isApplicationExecutionAuthenticInternal(
  value: unknown,
): value is object {
  return isSealed(
    value,
    authenticApplicationExecutions,
    applicationExecutionSeal,
  );
}

export function sealApplicationResultInternal<T extends object>(
  value: T,
): Readonly<T> {
  return seal(value, authenticApplicationResults, applicationResultSeal);
}

export function isApplicationResultAuthenticInternal(
  value: unknown,
): value is object {
  return isSealed(value, authenticApplicationResults, applicationResultSeal);
}

export function immutableApplicationCopyInternal<T>(value: T): T {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => immutableApplicationCopyInternal(item)),
    ) as T;
  }
  if (typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      copy[key] = immutableApplicationCopyInternal(source[key]);
    }
    return Object.freeze(copy) as T;
  }
  return value;
}
