const ALLOWED_STATUSES = new Set(["pending", "in_progress", "blocked", "failed", "passed"]);
const REQUIRED_PROOF_FIELDS = [
  "implementationEvidence",
  "verificationEvidence",
  "productionEvidence",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStringItems(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

export function validateReleaseIssueGates(document, options = {}) {
  const version = options.version;
  const requirePassed = options.requirePassed ?? true;
  const errors = [];

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return {
      valid: false,
      errors: ["release issue gate document must be an object"],
    };
  }

  const expectedTag = version ? `v${version}` : document.releaseTag;

  if (document.schemaVersion !== "1.0.0") {
    errors.push("schemaVersion must be 1.0.0");
  }

  if (version && document.releaseVersion !== version) {
    errors.push(`releaseVersion must match package version ${version}`);
  }

  if (!isNonEmptyString(document.releaseTag)) {
    errors.push("releaseTag is required");
  } else if (expectedTag && document.releaseTag !== expectedTag) {
    errors.push(`releaseTag must be ${expectedTag}`);
  }

  if (document.passContract?.allIssuesMustPassProduction !== true) {
    errors.push("passContract.allIssuesMustPassProduction must be true");
  }

  if (document.passContract?.allIssuesMustHaveLabels !== true) {
    errors.push("passContract.allIssuesMustHaveLabels must be true");
  }

  if (!Array.isArray(document.issues) || document.issues.length === 0) {
    errors.push("issues must be a non-empty array");
    return { valid: errors.length === 0, errors };
  }

  const seen = new Set();
  for (const issue of document.issues) {
    const issueLabel = Number.isInteger(issue?.number) ? `#${issue.number}` : "<unknown issue>";

    if (!Number.isInteger(issue?.number) || issue.number <= 0) {
      errors.push(`${issueLabel}: number must be a positive integer`);
      continue;
    }

    if (seen.has(issue.number)) {
      errors.push(`${issueLabel}: duplicate issue number`);
    }
    seen.add(issue.number);

    if (!isNonEmptyString(issue.title)) {
      errors.push(`${issueLabel}: title is required`);
    }

    if (!isNonEmptyString(issue.url) || !issue.url.includes(`/issues/${issue.number}`)) {
      errors.push(`${issueLabel}: url must reference the GitHub issue`);
    }

    if (issue.releaseVersion !== document.releaseVersion) {
      errors.push(`${issueLabel}: releaseVersion must match document releaseVersion`);
    }

    if (issue.releaseTag !== document.releaseTag) {
      errors.push(`${issueLabel}: releaseTag must match document releaseTag`);
    }

    if (issue.milestone !== document.releaseTag) {
      errors.push(`${issueLabel}: milestone must match document releaseTag`);
    }

    if (!ALLOWED_STATUSES.has(issue.status)) {
      errors.push(`${issueLabel}: invalid status ${issue.status}`);
    }

    if (document.passContract?.allIssuesMustHaveLabels === true && !hasStringItems(issue.labels)) {
      errors.push(`${issueLabel}: labels must contain at least one issue label`);
    }

    if (!hasStringItems(issue.requiredProof)) {
      errors.push(`${issueLabel}: requiredProof must contain at least one proof requirement`);
    }

    if (!isNonEmptyString(issue.loopAction)) {
      errors.push(`${issueLabel}: loopAction is required until production proof passes`);
    }

    const proof = issue.proof;
    if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
      errors.push(`${issueLabel}: proof object is required`);
      continue;
    }

    for (const field of REQUIRED_PROOF_FIELDS) {
      if (!Array.isArray(proof[field])) {
        errors.push(`${issueLabel}: proof.${field} must be an array`);
      }
    }

    if (issue.status === "passed") {
      for (const field of REQUIRED_PROOF_FIELDS) {
        if (!hasStringItems(proof[field])) {
          errors.push(`${issueLabel}: status passed requires non-empty proof.${field}`);
        }
      }
    }

    if (requirePassed && issue.status !== "passed") {
      errors.push(`${issueLabel}: status is ${issue.status}; continue loopAction before release`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function summarizeReleaseIssueGateStatus(document, options = {}) {
  const structural = validateReleaseIssueGates(document, {
    ...options,
    requirePassed: false,
  });

  if (!structural.valid) {
    return {
      valid: false,
      total: 0,
      passed: 0,
      pending: 0,
      inProgress: 0,
      blocked: 0,
      failed: 0,
      blockers: structural.errors,
    };
  }

  const summary = {
    valid: true,
    total: document.issues.length,
    passed: 0,
    pending: 0,
    inProgress: 0,
    blocked: 0,
    failed: 0,
    blockers: [],
  };

  for (const issue of document.issues) {
    if (issue.status === "passed") {
      summary.passed += 1;
      continue;
    }

    if (issue.status === "pending") {
      summary.pending += 1;
    } else if (issue.status === "in_progress") {
      summary.inProgress += 1;
    } else if (issue.status === "blocked") {
      summary.blocked += 1;
    } else if (issue.status === "failed") {
      summary.failed += 1;
    }

    summary.blockers.push(
      `#${issue.number}: ${issue.status}; ${issue.loopAction || "continue implementation loop"}`,
    );
  }

  return summary;
}
