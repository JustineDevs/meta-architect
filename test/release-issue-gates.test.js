import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateReleaseIssueGates } from "../src/release-issue-gates.js";

test("release issue gate matrix is structurally valid", async () => {
  const gatePath = path.join("docs", "qa", "release-issue-gates-0.1.13.json");
  const document = JSON.parse(await fs.readFile(gatePath, "utf8"));

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: false,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(document.issues.length, 17);
});

test("release issue gate matrix passes production after every issue has proof", async () => {
  const gatePath = path.join("docs", "qa", "release-issue-gates-0.1.13.json");
  const document = JSON.parse(await fs.readFile(gatePath, "utf8"));

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: true,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(
    document.issues.every((issue) => issue.status === "passed"),
    true,
  );
  assert.equal(
    document.issues.every((issue) =>
      ["implementationEvidence", "verificationEvidence", "productionEvidence"].every(
        (field) => issue.proof[field].length > 0,
      ),
    ),
    true,
  );
});

test("release issue gate can pass when every issue has proof", () => {
  const document = {
    schemaVersion: "1.0.0",
    releaseVersion: "0.1.13",
    releaseTag: "v0.1.13",
    passContract: {
      allIssuesMustPassProduction: true,
      allIssuesMustHaveLabels: true,
    },
    issues: [
      {
        number: 13,
        title: "Example passed parent",
        url: "https://github.com/JustineDevs/meta-architect/issues/13",
        releaseVersion: "0.1.13",
        releaseTag: "v0.1.13",
        milestone: "v0.1.13",
        labels: ["feature", "next-release", "v0.1.13"],
        status: "passed",
        requiredProof: ["implementation", "verification", "production"],
        loopAction: "No loop action needed after proof.",
        proof: {
          implementationEvidence: ["implemented feature"],
          verificationEvidence: ["node --test"],
          productionEvidence: ["npm run release:verify"],
        },
      },
    ],
  };

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: true,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test("release issue gate blocks production while issues are not passed", () => {
  const document = {
    schemaVersion: "1.0.0",
    releaseVersion: "0.1.13",
    releaseTag: "v0.1.13",
    passContract: {
      allIssuesMustPassProduction: true,
      allIssuesMustHaveLabels: true,
    },
    issues: [
      {
        number: 13,
        title: "Example pending parent",
        url: "https://github.com/JustineDevs/meta-architect/issues/13",
        releaseVersion: "0.1.13",
        releaseTag: "v0.1.13",
        milestone: "v0.1.13",
        labels: ["feature", "next-release", "v0.1.13"],
        status: "pending",
        requiredProof: ["implementation", "verification", "production"],
        loopAction: "Continue implementation loop.",
        proof: {
          implementationEvidence: [],
          verificationEvidence: [],
          productionEvidence: [],
        },
      },
    ],
  };

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: true,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /#13: status is pending/);
});

test("passed issue requires all proof evidence buckets", () => {
  const document = {
    schemaVersion: "1.0.0",
    releaseVersion: "0.1.13",
    releaseTag: "v0.1.13",
    passContract: {
      allIssuesMustPassProduction: true,
      allIssuesMustHaveLabels: true,
    },
    issues: [
      {
        number: 99,
        title: "Example release issue",
        url: "https://github.com/JustineDevs/meta-architect/issues/99",
        releaseVersion: "0.1.13",
        releaseTag: "v0.1.13",
        milestone: "v0.1.13",
        labels: ["feature", "next-release", "v0.1.13"],
        status: "passed",
        requiredProof: ["implementation", "verification", "production"],
        loopAction: "No loop action needed after evidence is present.",
        proof: {
          implementationEvidence: ["commit abc"],
          verificationEvidence: ["npm test"],
          productionEvidence: [],
        },
      },
    ],
  };

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: true,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /proof.productionEvidence/);
});

test("release issue gate requires labels for every tracked issue", () => {
  const document = {
    schemaVersion: "1.0.0",
    releaseVersion: "0.1.13",
    releaseTag: "v0.1.13",
    passContract: {
      allIssuesMustPassProduction: true,
      allIssuesMustHaveLabels: true,
    },
    issues: [
      {
        number: 13,
        title: "Example unlabeled parent",
        url: "https://github.com/JustineDevs/meta-architect/issues/13",
        releaseVersion: "0.1.13",
        releaseTag: "v0.1.13",
        milestone: "v0.1.13",
        labels: [],
        status: "pending",
        requiredProof: ["implementation", "verification", "production"],
        loopAction: "Add missing labels before release.",
        proof: {
          implementationEvidence: [],
          verificationEvidence: [],
          productionEvidence: [],
        },
      },
    ],
  };

  const result = validateReleaseIssueGates(document, {
    version: "0.1.13",
    requirePassed: false,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /#13: labels must contain at least one issue label/);
});
