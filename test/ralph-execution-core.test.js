import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRalphProgressEntry,
  completeRalphStory,
  createRalphIterationPlan,
  createRalphPrdContract,
  selectNextRalphStory,
} from "../src/runtime/ralph-execution-core.js";

test("Ralph story completion requires fresh verification evidence", () => {
  const prd = createRalphPrdContract({
    buildSlice: ["Implement bounded feature."],
    verificationPlan: ["Run npm test."],
  });

  assert.throws(
    () => completeRalphStory({ prd, storyId: "US-001" }),
    /fresh verification evidence/,
  );

  const completed = completeRalphStory({
    prd,
    storyId: "US-001",
    verificationEvidence: ["npm test passed"],
    notes: "Completed safely.",
  });

  assert.equal(completed.userStories[0].passes, true);
  assert.match(completed.userStories[0].notes, /npm test passed/);
  assert.equal(completed.evidenceBoundary.releaseStateMutationAllowed, false);
});

test("Ralph progress entries are append-only text records", () => {
  const next = appendRalphProgressEntry({
    current: "# Ralph Execution Progress\n",
    storyId: "US-001",
    status: "passed",
    evidence: ["npm test"],
  });

  assert.match(next, /US-001 passed/);
  assert.match(next, /evidence=npm test/);
});

test("Ralph selects the highest-priority incomplete story and creates an iteration plan", () => {
  const prd = createRalphPrdContract({
    buildSlice: ["Implement bounded feature."],
    verificationPlan: ["Run npm test."],
  });
  prd.userStories.push({
    id: "US-002",
    title: "Lower-priority story",
    description: "Wait until US-001 completes.",
    acceptanceCriteria: ["Must not run before US-001."],
    priority: 9,
    passes: false,
    notes: "",
  });

  const story = selectNextRalphStory({ prd });
  const plan = createRalphIterationPlan({
    prd,
    progress: "# Ralph Execution Progress\n- previous evidence\n",
    role: "executor",
  });

  assert.equal(story.id, "US-001");
  assert.equal(plan.status, "ready");
  assert.equal(plan.next_story.id, "US-001");
  assert.equal(plan.required_gates.includes("$build"), true);
  assert.equal(plan.stop_conditions.includes("fresh_verification_evidence_missing"), true);
  assert.match(plan.loop_instruction, /Execute exactly this story/);
});

test("Ralph iteration plan returns complete when no stories remain", () => {
  const prd = completeRalphStory({
    prd: createRalphPrdContract({
      buildSlice: ["Implement bounded feature."],
      verificationPlan: ["Run npm test."],
    }),
    storyId: "US-001",
    verificationEvidence: ["npm test passed"],
  });

  const plan = createRalphIterationPlan({ prd });

  assert.equal(plan.status, "complete");
  assert.equal(plan.next_story, null);
  assert.match(plan.instruction, /Return through \$maestro/);
});
