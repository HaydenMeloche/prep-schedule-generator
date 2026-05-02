const TEACHERS = ["EK", "E1A", "E12", "E23"];
const DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
const REQUIRED_MINUTES = 240;
const UNIT_MINUTES = 20;

const TEACHER_COLORS = {
  EK: "#c9532f",
  E1A: "#546f55",
  E12: "#507a95",
  E23: "#b85f70",
};

const TIME_ROWS = [
  { time: "9:15-9:35", block: "Morning", period: "morning", unit: 0 },
  { time: "9:35-9:55", block: "Morning", period: "morning", unit: 1 },
  { time: "9:55-10:15", block: "Morning", period: "morning", unit: 2 },
  { time: "10:15-10:35", block: "Morning", period: "morning", unit: 3 },
  { time: "10:35-10:55", block: "Morning", period: "morning", unit: 4 },
  {
    time: "10:55-11:35",
    block: "Nutrition Break 1",
    type: "break",
    note: "No coverage",
  },
  { time: "11:35-12:25", block: "Middle", type: "middle" },
  { time: "12:25-1:15", block: "Middle", type: "middle" },
  {
    time: "1:15-1:55",
    block: "Nutrition Break 2",
    type: "break",
    note: "No coverage",
  },
  { time: "1:55-2:15", block: "Afternoon", period: "afternoon", unit: 0 },
  { time: "2:15-2:35", block: "Afternoon", period: "afternoon", unit: 1 },
  { time: "2:35-2:55", block: "Afternoon", period: "afternoon", unit: 2 },
  { time: "2:55-3:15", block: "Afternoon", period: "afternoon", unit: 3 },
  { time: "3:15-3:35", block: "Afternoon", period: "afternoon", unit: 4 },
];

const DUTY_TARGET_MINUTES = 80;
const DUTY_MAX_STAFF = 34;
const DUTY_MIN_STAFF_FOR_COVERAGE = 6;

const DUTY_GROUPS = [
  {
    time: "9:00-9:15",
    label: "Morning",
    duration: 15,
    timeKey: "morning-arrival",
    duties: ["Bus", "Kiss n ride", "Prim", "Jr", "Jr/int", "In"],
  },
  {
    time: "10:55-11:15",
    label: "NB outside",
    duration: 20,
    timeKey: "nb1-outside",
    duties: ["Kinder", "Prim", "Prim field", "Jr field", "Int", "Int field"],
  },
  {
    time: "11:15-11:35",
    label: "NB halls",
    duration: 20,
    timeKey: "nb1-halls",
    duties: ["Kinder", "Int hall", "Jr hall", "P hall"],
  },
  {
    time: "1:15-1:35",
    label: "NB outside",
    duration: 20,
    timeKey: "nb2-outside",
    duties: ["Kinder", "Prim", "Prim field", "Jr field", "Int", "Int field"],
  },
  {
    time: "1:35-1:55",
    label: "NB halls",
    duration: 20,
    timeKey: "nb2-halls",
    duties: ["Kinder", "Int hall", "Jr hall", "P hall"],
  },
  {
    time: "3:35-3:40",
    label: "Dismissal",
    duration: 5,
    timeKey: "dismissal",
    duties: ["Prim playground", "Kiss n ride", "Front bus", "Mid bus", "Kinder"],
  },
  {
    time: "3:35-3:50",
    label: "Dismissal",
    duration: 15,
    timeKey: "dismissal",
    duties: ["Back bus"],
  },
];

const DUTY_ROWS = DUTY_GROUPS.flatMap((group) =>
  group.duties.map((duty) => ({
    time: group.time,
    group: group.label,
    duration: group.duration,
    timeKey: group.timeKey,
    duty,
    baseKey: `${group.timeKey}:${duty}`,
  })),
);

const DUTY_TOTAL_MINUTES =
  DUTY_ROWS.reduce((total, row) => total + row.duration, 0) * DAYS.length;

let scheduleBody;
let totalsElement;
let statusElement;
let consistentToggle;
let staffCountInput;
let dutyConsistentToggle;
let dutyBody;
let dutyTotalsElement;
let dutyStatusElement;

if (typeof document !== "undefined") {
  initializePage();
}

if (typeof module !== "undefined") {
  module.exports = {
    generateSchedule,
    validateSchedule,
    generateDutySchedule,
    validateDutySchedule,
  };
}

function initializePage() {
  scheduleBody = document.querySelector("#schedule-body");
  totalsElement = document.querySelector("#totals");
  statusElement = document.querySelector("#status");
  consistentToggle = document.querySelector("#consistent-toggle");
  staffCountInput = document.querySelector("#staff-count");
  dutyConsistentToggle = document.querySelector("#duty-consistent-toggle");
  dutyBody = document.querySelector("#duty-body");
  dutyTotalsElement = document.querySelector("#duty-totals");
  dutyStatusElement = document.querySelector("#duty-status");

  document.querySelector("#generate-button").addEventListener("click", () => {
    try {
      const consistentDaily = consistentToggle.checked;
      const schedule = generateSchedule({ consistentDaily });
      const validation = validateSchedule(schedule);

      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      renderSchedule(schedule);
      renderTotals(validation.totals);
      statusElement.textContent =
        consistentDaily
          ? "Consistent route generated. Each class keeps the same daily order and gets prep every day."
          : "Prep teacher route generated. Each class has one prep block every day.";
    } catch (error) {
      statusElement.textContent = `Unable to generate a valid schedule: ${error.message}`;
    }
  });

  document.querySelector("#generate-duty-button").addEventListener("click", () => {
    try {
      const staffCount = Number.parseInt(staffCountInput.value, 10);
      const consistent = dutyConsistentToggle.checked;
      const schedule = generateDutySchedule(staffCount, { consistent });
      const validation = validateDutySchedule(schedule);

      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      renderDutySchedule(schedule);
      renderDutyTotals(schedule.totals, schedule.staffNames);
      dutyStatusElement.textContent = createDutyStatus(schedule, consistent);
    } catch (error) {
      dutyStatusElement.textContent = `Unable to generate a duty schedule: ${error.message}`;
    }
  });

  renderEmptyTable();
  renderTotals(Object.fromEntries(TEACHERS.map((teacher) => [teacher, 0])));
  renderEmptyDutyTable();
  dutyTotalsElement.innerHTML = "";
}

function generateSchedule(options = {}) {
  if (options.consistentDaily) {
    return generateConsistentSchedule();
  }

  for (let attempt = 0; attempt < 150; attempt += 1) {
    const specs = createSegmentSpecs();
    const remaining = Object.fromEntries(
      TEACHERS.map((teacher) => [teacher, { 2: 3, 3: 2 }]),
    );
    const dayAssignments = DAYS.map(() => new Set());
    const assignments = [];

    if (assignSegment(0, specs, remaining, dayAssignments, assignments)) {
      return buildSchedule(specs, assignments);
    }
  }

  throw new Error("the solver exhausted its attempts");
}

function generateConsistentSchedule() {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const positionTeachers = shuffle(TEACHERS);
    const positionLengths = createConsistentPositionLengths();

    if (positionLengths === null) {
      continue;
    }

    const schedule = DAYS.map((day, dayIndex) => ({
      morning: placeConsistentSegment([
        {
          teacher: positionTeachers[0],
          length: positionLengths[0][dayIndex],
        },
        {
          teacher: positionTeachers[1],
          length: positionLengths[1][dayIndex],
        },
      ]),
      afternoon: placeConsistentSegment([
        {
          teacher: positionTeachers[2],
          length: positionLengths[2][dayIndex],
        },
        {
          teacher: positionTeachers[3],
          length: positionLengths[3][dayIndex],
        },
      ]),
    }));

    if (validateSchedule(schedule).valid) {
      return schedule;
    }
  }

  throw new Error("the consistent solver exhausted its attempts");
}

function createConsistentPositionLengths() {
  const lengths = Array.from({ length: TEACHERS.length }, () =>
    Array.from({ length: DAYS.length }, () => 2),
  );

  if (assignLongBlocksToPosition(0, lengths)) {
    return lengths;
  }

  return null;
}

function assignLongBlocksToPosition(positionIndex, lengths) {
  if (positionIndex === TEACHERS.length) {
    return true;
  }

  for (const daysWithLongBlocks of shuffle(getTwoDayCombinations())) {
    if (daysWithLongBlocks.some((dayIndex) => hasPeriodConflict(positionIndex, dayIndex, lengths))) {
      continue;
    }

    daysWithLongBlocks.forEach((dayIndex) => {
      lengths[positionIndex][dayIndex] = 3;
    });

    if (assignLongBlocksToPosition(positionIndex + 1, lengths)) {
      return true;
    }

    daysWithLongBlocks.forEach((dayIndex) => {
      lengths[positionIndex][dayIndex] = 2;
    });
  }

  return false;
}

function getTwoDayCombinations() {
  const combinations = [];

  for (let firstDay = 0; firstDay < DAYS.length - 1; firstDay += 1) {
    for (let secondDay = firstDay + 1; secondDay < DAYS.length; secondDay += 1) {
      combinations.push([firstDay, secondDay]);
    }
  }

  return combinations;
}

function hasPeriodConflict(positionIndex, dayIndex, lengths) {
  const siblingPosition = positionIndex % 2 === 0 ? positionIndex + 1 : positionIndex - 1;
  return lengths[siblingPosition][dayIndex] === 3;
}

function placeConsistentSegment(blocks) {
  const slots = [];

  blocks.forEach((block) => {
    pushBlock(slots, block);
  });

  while (slots.length < 5) {
    slots.push(null);
  }

  return slots;
}

function generateDutySchedule(staffCount, options = {}) {
  const normalizedStaffCount = normalizeStaffCount(staffCount);

  if (normalizedStaffCount < DUTY_MIN_STAFF_FOR_COVERAGE) {
    throw new Error(
      `at least ${DUTY_MIN_STAFF_FOR_COVERAGE} staff are required because six duties happen at the same time`,
    );
  }

  let bestSchedule = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const attempts = options.consistent ? 120 : 60;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const schedule = buildDutySchedule(normalizedStaffCount, options);
    const validation = validateDutySchedule(schedule);

    if (!validation.valid) {
      continue;
    }

    const score = scoreDutySchedule(schedule, options);

    if (score < bestScore) {
      bestScore = score;
      bestSchedule = schedule;
    }
  }

  if (bestSchedule === null) {
    throw new Error("the duty solver exhausted its attempts");
  }

  improveDutyBalance(bestSchedule, options);

  return bestSchedule;
}

function normalizeStaffCount(staffCount) {
  if (!Number.isFinite(staffCount)) {
    throw new Error("enter a valid staff count");
  }

  return Math.min(DUTY_MAX_STAFF, Math.max(1, Math.trunc(staffCount)));
}

function buildDutySchedule(staffCount, options) {
  const staffNames = createStaffNames(staffCount);
  const staffRecords = staffNames.map((name) => ({
    name,
    total: 0,
    busy: new Set(),
    baseCounts: new Map(),
  }));
  const rows = DUTY_ROWS.map((row) => ({
    ...row,
    assignments: Array.from({ length: DAYS.length }, () => null),
  }));
  const assignmentOrder = createDutyAssignmentOrder(rows, options.consistent);

  assignmentOrder.forEach(({ rowIndex, dayIndex }) => {
    const row = rows[rowIndex];
    const staff = chooseDutyStaff(row, dayIndex, staffRecords, staffCount, options);

    row.assignments[dayIndex] = staff.name;
    staff.total += row.duration;
    staff.busy.add(createBusyKey(dayIndex, row.timeKey));
    staff.baseCounts.set(row.baseKey, (staff.baseCounts.get(row.baseKey) || 0) + 1);
  });

  const totals = Object.fromEntries(staffRecords.map((staff) => [staff.name, staff.total]));

  return {
    rows,
    staffNames,
    totals,
    targetMinutes: DUTY_TARGET_MINUTES,
    averageMinutes: DUTY_TOTAL_MINUTES / staffCount,
    totalMinutes: DUTY_TOTAL_MINUTES,
  };
}

function createDutyAssignmentOrder(rows, consistent) {
  if (consistent) {
    const rowOrder = rows
      .map((row, rowIndex) => ({ row, rowIndex, tieBreak: Math.random() }))
      .sort(
        (left, right) =>
          right.row.duration - left.row.duration || left.tieBreak - right.tieBreak,
      );

    return rowOrder.flatMap(({ rowIndex }) =>
      shuffle(DAYS.map((day, dayIndex) => ({ rowIndex, dayIndex }))),
    );
  }

  return shuffle(
    rows.flatMap((row, rowIndex) =>
      DAYS.map((day, dayIndex) => ({ rowIndex, dayIndex })),
    ),
  );
}

function chooseDutyStaff(row, dayIndex, staffRecords, staffCount, options) {
  const balanceTarget = Math.max(DUTY_TARGET_MINUTES, DUTY_TOTAL_MINUTES / staffCount);
  const candidates = staffRecords.filter(
    (staff) => !staff.busy.has(createBusyKey(dayIndex, row.timeKey)),
  );
  const unusedStaffAvailable = candidates.some((staff) => staff.total === 0);
  const hasConsistentCandidate = candidates.some((staff) => {
    const baseCount = staff.baseCounts.get(row.baseKey) || 0;
    return baseCount > 0 && staff.total + row.duration <= balanceTarget + 5;
  });

  if (candidates.length === 0) {
    throw new Error(`no available staff for ${row.duty} on ${DAYS[dayIndex]}`);
  }

  return candidates
    .map((staff) => ({
      staff,
      score: scoreDutyCandidate(staff, row, balanceTarget, options, {
        unusedStaffAvailable,
        hasConsistentCandidate,
      }),
    }))
    .sort((left, right) => left.score - right.score)[0].staff;
}

function scoreDutyCandidate(staff, row, balanceTarget, options, context) {
  const projectedTotal = staff.total + row.duration;
  const underTarget = Math.max(0, balanceTarget - projectedTotal);
  const overTarget = Math.max(0, projectedTotal - balanceTarget);
  let score = underTarget + overTarget * 4 + staff.total * 0.05 + Math.random() * 0.4;

  if (options.consistent) {
    const baseCount = staff.baseCounts.get(row.baseKey) || 0;

    if (context.unusedStaffAvailable && !context.hasConsistentCandidate) {
      score += staff.total === 0 ? -90 : 50;
    }

    if (baseCount > 0 && projectedTotal <= balanceTarget + 5) {
      score -= 28 + baseCount * 5;
    }

  }

  if (balanceTarget <= DUTY_TARGET_MINUTES && projectedTotal > DUTY_TARGET_MINUTES) {
    score += (projectedTotal - DUTY_TARGET_MINUTES) * 8;
  }

  return score;
}

function createBusyKey(dayIndex, timeKey) {
  return `${dayIndex}:${timeKey}`;
}

function createStaffNames(staffCount) {
  return Array.from({ length: staffCount }, (item, index) => `Staff ${index + 1}`);
}

function validateDutySchedule(schedule) {
  const errors = [];
  const staffSet = new Set(schedule.staffNames);
  const totals = Object.fromEntries(schedule.staffNames.map((staff) => [staff, 0]));
  const busy = new Map();

  schedule.rows.forEach((row) => {
    row.assignments.forEach((staff, dayIndex) => {
      if (!staff) {
        errors.push(`${row.duty} is unassigned on ${DAYS[dayIndex]}.`);
        return;
      }

      if (!staffSet.has(staff)) {
        errors.push(`${row.duty} has unknown staff ${staff} on ${DAYS[dayIndex]}.`);
        return;
      }

      totals[staff] += row.duration;

      const busyKey = createBusyKey(dayIndex, row.timeKey);
      const staffAtTime = busy.get(busyKey) || new Set();

      if (staffAtTime.has(staff)) {
        errors.push(`${staff} has overlapping duties on ${DAYS[dayIndex]} at ${row.time}.`);
      }

      staffAtTime.add(staff);
      busy.set(busyKey, staffAtTime);
    });
  });

  schedule.staffNames.forEach((staff) => {
    if (totals[staff] !== schedule.totals[staff]) {
      errors.push(`${staff} total is inconsistent.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    totals,
  };
}

function scoreDutySchedule(schedule, options) {
  const balanceTarget = Math.max(DUTY_TARGET_MINUTES, schedule.averageMinutes);
  const totals = Object.values(schedule.totals);
  const fairnessScore = totals.reduce(
    (score, total) => score + Math.abs(total - balanceTarget),
    0,
  );
  const overTargetScore =
    schedule.averageMinutes <= DUTY_TARGET_MINUTES
      ? totals.reduce((score, total) => score + Math.max(0, total - DUTY_TARGET_MINUTES) * 10, 0)
      : 0;
  const consistencyScore = options.consistent
    ? schedule.rows.reduce((score, row) => score + new Set(row.assignments).size - 1, 0)
    : 0;
  const unusedStaffScore = totals.filter((total) => total === 0).length * 500;
  const rangeScore = (Math.max(...totals) - Math.min(...totals)) * 3;

  return fairnessScore + overTargetScore + consistencyScore * 8 + unusedStaffScore + rangeScore;
}

function improveDutyBalance(schedule, options) {
  let improved = true;
  let currentScore = scoreDutySchedule(schedule, options);

  while (improved) {
    improved = false;
    const staffByTotal = [...schedule.staffNames].sort(
      (left, right) => schedule.totals[left] - schedule.totals[right],
    );

    for (const lowStaff of staffByTotal) {
      for (const highStaff of [...staffByTotal].reverse()) {
        if (schedule.totals[highStaff] <= schedule.totals[lowStaff]) {
          continue;
        }

        const move = findImprovingDutyMove(schedule, lowStaff, highStaff, options, currentScore);

        if (move !== null) {
          applyDutyMove(schedule, move, lowStaff, highStaff);
          currentScore = scoreDutySchedule(schedule, options);
          improved = true;
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }
}

function findImprovingDutyMove(schedule, lowStaff, highStaff, options, currentScore) {
  for (const row of shuffle(schedule.rows)) {
    for (const dayIndex of shuffle(DAYS.map((day, index) => index))) {
      if (row.assignments[dayIndex] !== highStaff) {
        continue;
      }

      if (hasDutyConflict(schedule, lowStaff, dayIndex, row.timeKey)) {
        continue;
      }

      row.assignments[dayIndex] = lowStaff;
      schedule.totals[lowStaff] += row.duration;
      schedule.totals[highStaff] -= row.duration;

      const newScore = scoreDutySchedule(schedule, options);

      row.assignments[dayIndex] = highStaff;
      schedule.totals[lowStaff] -= row.duration;
      schedule.totals[highStaff] += row.duration;

      if (newScore < currentScore) {
        return { row, dayIndex, duration: row.duration };
      }
    }
  }

  return null;
}

function applyDutyMove(schedule, move, lowStaff, highStaff) {
  move.row.assignments[move.dayIndex] = lowStaff;
  schedule.totals[lowStaff] += move.duration;
  schedule.totals[highStaff] -= move.duration;
}

function hasDutyConflict(schedule, staff, dayIndex, timeKey) {
  return schedule.rows.some(
    (row) => row.timeKey === timeKey && row.assignments[dayIndex] === staff,
  );
}

function createSegmentSpecs() {
  const segmentNames = [];

  DAYS.forEach((day, dayIndex) => {
    segmentNames.push({ day, dayIndex, period: "morning" });
    segmentNames.push({ day, dayIndex, period: "afternoon" });
  });

  const occupancyPatterns = shuffle([
    ...Array.from({ length: 8 }, () => "full"),
    ...Array.from({ length: 2 }, () => "partial"),
  ]);

  return segmentNames.map((segment, index) => {
    const pattern = occupancyPatterns[index];
    const lengths = pattern === "full" ? shuffle([2, 3]) : [2, 2];
    const emptyIndex = pattern === "partial" ? randomItem([0, 2, 4]) : null;

    return {
      ...segment,
      pattern,
      lengths,
      emptyIndex,
    };
  });
}

function assignSegment(index, specs, remaining, dayAssignments, assignments) {
  if (index === specs.length) {
    return TEACHERS.every(
      (teacher) => remaining[teacher][2] === 0 && remaining[teacher][3] === 0,
    ) && dayAssignments.every((assignedTeachers) => assignedTeachers.size === TEACHERS.length);
  }

  const spec = specs[index];
  const candidates = createCandidates(spec, remaining, dayAssignments);

  for (const candidate of candidates) {
    applyCandidate(candidate, remaining, -1);
    applyDayAssignment(candidate, dayAssignments[spec.dayIndex], "add");
    assignments[index] = candidate;

    if (
      remainingCountsArePossible(index + 1, specs, remaining) &&
      assignSegment(index + 1, specs, remaining, dayAssignments, assignments)
    ) {
      return true;
    }

    applyDayAssignment(candidate, dayAssignments[spec.dayIndex], "delete");
    applyCandidate(candidate, remaining, 1);
    assignments[index] = null;
  }

  return false;
}

function createCandidates(spec, remaining, dayAssignments) {
  const candidates = [];
  const usedToday = dayAssignments[spec.dayIndex];
  const [firstLength, secondLength] = spec.lengths;

  for (const firstTeacher of TEACHERS) {
    if (usedToday.has(firstTeacher) || remaining[firstTeacher][firstLength] <= 0) {
      continue;
    }

    for (const secondTeacher of TEACHERS) {
      if (secondTeacher === firstTeacher || usedToday.has(secondTeacher)) {
        continue;
      }

      if (remaining[secondTeacher][secondLength] <= 0) {
        continue;
      }

      candidates.push([
        { teacher: firstTeacher, length: firstLength },
        { teacher: secondTeacher, length: secondLength },
      ]);
    }
  }

  return shuffle(candidates);
}

function applyCandidate(candidate, remaining, direction) {
  candidate.forEach(({ teacher, length }) => {
    remaining[teacher][length] += direction;
  });
}

function applyDayAssignment(candidate, assignedTeachers, operation) {
  candidate.forEach(({ teacher }) => {
    assignedTeachers[operation](teacher);
  });
}

function remainingCountsArePossible(nextIndex, specs, remaining) {
  const futureSpecs = specs.slice(nextIndex);
  const futureLengthSlots = { 2: 0, 3: 0 };

  futureSpecs.forEach((spec) => {
    spec.lengths.forEach((length) => {
      futureLengthSlots[length] += 1;
    });
  });

  for (const teacher of TEACHERS) {
    const totalTeacherBlocks = remaining[teacher][2] + remaining[teacher][3];

    if (remaining[teacher][2] > futureLengthSlots[2]) {
      return false;
    }

    if (remaining[teacher][3] > futureLengthSlots[3]) {
      return false;
    }

    if (totalTeacherBlocks > futureSpecs.length) {
      return false;
    }
  }

  return true;
}

function buildSchedule(specs, assignments) {
  const schedule = DAYS.map(() => ({
    morning: Array.from({ length: 5 }, () => null),
    afternoon: Array.from({ length: 5 }, () => null),
  }));

  specs.forEach((spec, index) => {
    const segmentSlots = expandSegment(spec, assignments[index]);
    schedule[spec.dayIndex][spec.period] = segmentSlots;
  });

  return schedule;
}

function expandSegment(spec, blocks) {
  const slots = [];

  if (spec.pattern === "partial" && spec.emptyIndex === 0) {
    slots.push(null);
  }

  pushBlock(slots, blocks[0]);

  if (spec.pattern === "partial" && spec.emptyIndex === 2) {
    slots.push(null);
  }

  pushBlock(slots, blocks[1]);

  if (spec.pattern === "partial" && spec.emptyIndex === 4) {
    slots.push(null);
  }

  return slots;
}

function pushBlock(slots, block) {
  for (let unit = 0; unit < block.length; unit += 1) {
    slots.push(block.teacher);
  }
}

function validateSchedule(schedule) {
  const errors = [];
  const unitTotals = Object.fromEntries(TEACHERS.map((teacher) => [teacher, 0]));
  const dailyBlockCounts = DAYS.map(() =>
    Object.fromEntries(TEACHERS.map((teacher) => [teacher, 0])),
  );

  schedule.forEach((day, dayIndex) => {
    ["morning", "afternoon"].forEach((period) => {
      const slots = day[period];

      if (slots.length !== 5) {
        errors.push(`${DAYS[dayIndex]} ${period} does not contain 5 slots.`);
      }

      slots.forEach((teacher) => {
        if (teacher !== null && !TEACHERS.includes(teacher)) {
          errors.push(`${teacher} is not a known teacher.`);
        }

        if (teacher !== null) {
          unitTotals[teacher] += 1;
        }
      });

      validateRuns(slots, `${DAYS[dayIndex]} ${period}`, errors);
      countDailyRuns(slots, dailyBlockCounts[dayIndex]);
    });

    TEACHERS.forEach((teacher) => {
      if (dailyBlockCounts[dayIndex][teacher] < 1) {
        errors.push(`${teacher} does not have prep on ${DAYS[dayIndex]}.`);
      }
    });
  });

  const totals = Object.fromEntries(
    TEACHERS.map((teacher) => [teacher, unitTotals[teacher] * UNIT_MINUTES]),
  );

  TEACHERS.forEach((teacher) => {
    if (totals[teacher] !== REQUIRED_MINUTES) {
      errors.push(`${teacher} has ${totals[teacher]} minutes instead of 240.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    totals,
  };
}

function countDailyRuns(slots, dailyCounts) {
  let index = 0;

  while (index < slots.length) {
    const teacher = slots[index];

    if (teacher === null) {
      index += 1;
      continue;
    }

    dailyCounts[teacher] += 1;

    while (slots[index] === teacher) {
      index += 1;
    }
  }
}

function validateRuns(slots, label, errors) {
  let index = 0;

  while (index < slots.length) {
    const teacher = slots[index];

    if (teacher === null) {
      index += 1;
      continue;
    }

    let runLength = 1;

    while (slots[index + runLength] === teacher) {
      runLength += 1;
    }

    if (runLength !== 2 && runLength !== 3) {
      errors.push(`${label} has a ${runLength * UNIT_MINUTES}-minute ${teacher} block.`);
    }

    index += runLength;
  }
}

function renderSchedule(schedule) {
  scheduleBody.innerHTML = "";

  TIME_ROWS.forEach((row) => {
    const tableRow = document.createElement("tr");

    if (row.type === "break") {
      tableRow.className = "break-row";
    }

    if (row.type === "middle") {
      tableRow.className = "middle-row";
    }

    tableRow.append(createHeaderCell(row.time));
    tableRow.append(createBlockCell(row.block));

    DAYS.forEach((day, dayIndex) => {
      const cell = document.createElement("td");
      cell.className = "day-cell";

      if (row.type === "break") {
        cell.innerHTML = `<span class="break-note">${row.note}</span>`;
      } else if (row.type === "middle") {
        cell.innerHTML = '<span class="middle-note">No coverage</span>';
      } else {
        const teacher = schedule[dayIndex][row.period][row.unit];
        cell.append(renderTeacherCell(teacher));
      }

      tableRow.append(cell);
    });

    scheduleBody.append(tableRow);
  });
}

function renderEmptyTable() {
  const blankSchedule = DAYS.map(() => ({
    morning: Array.from({ length: 5 }, () => null),
    afternoon: Array.from({ length: 5 }, () => null),
  }));

  renderSchedule(blankSchedule);
}

function renderTeacherCell(teacher) {
  if (teacher === null) {
    const empty = document.createElement("span");
    empty.className = "empty-cell";
    empty.textContent = "";
    empty.setAttribute("aria-label", "No prep scheduled");
    return empty;
  }

  const chip = document.createElement("span");
  chip.className = "prep-chip";
  chip.textContent = `Cover ${teacher}`;
  chip.style.setProperty("--teacher-color", TEACHER_COLORS[teacher]);
  chip.setAttribute("aria-label", `Prep teacher covers ${teacher}`);
  return chip;
}

function createHeaderCell(text) {
  const cell = document.createElement("th");
  cell.scope = "row";
  cell.textContent = text;
  return cell;
}

function createBlockCell(text) {
  const cell = document.createElement("td");
  cell.className = "block-label";
  cell.textContent = text;
  return cell;
}

function renderTotals(totals) {
  totalsElement.innerHTML = "";

  TEACHERS.forEach((teacher) => {
    const pill = document.createElement("span");
    pill.className = "total-pill";
    pill.innerHTML = `
      <span class="teacher-dot" style="--teacher-color: ${TEACHER_COLORS[teacher]}"></span>
      ${teacher} prep: ${totals[teacher]} min
    `;
    totalsElement.append(pill);
  });
}

function renderEmptyDutyTable() {
  const emptySchedule = {
    rows: DUTY_ROWS.map((row) => ({
      ...row,
      assignments: Array.from({ length: DAYS.length }, () => null),
    })),
  };

  renderDutySchedule(emptySchedule);
}

function renderDutySchedule(schedule) {
  dutyBody.innerHTML = "";

  schedule.rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    tableRow.append(createHeaderCell(row.time));
    tableRow.append(createDutyNameCell(row));
    tableRow.append(createDurationCell(row.duration));

    row.assignments.forEach((staff) => {
      const cell = document.createElement("td");
      cell.className = "day-cell";
      cell.append(renderDutyStaffCell(staff));
      tableRow.append(cell);
    });

    dutyBody.append(tableRow);
  });
}

function createDutyNameCell(row) {
  const cell = document.createElement("td");
  cell.className = "block-label";
  cell.textContent = `${row.group}: ${row.duty}`;
  return cell;
}

function createDurationCell(duration) {
  const cell = document.createElement("td");
  cell.className = "duration-cell";
  cell.textContent = duration;
  return cell;
}

function renderDutyStaffCell(staff) {
  if (staff === null) {
    const empty = document.createElement("span");
    empty.className = "empty-cell";
    empty.textContent = "";
    empty.setAttribute("aria-label", "No duty assigned");
    return empty;
  }

  const chip = document.createElement("span");
  chip.className = "duty-chip";
  chip.textContent = staff;
  return chip;
}

function renderDutyTotals(totals, staffNames) {
  dutyTotalsElement.innerHTML = "";

  staffNames.forEach((staff) => {
    const total = totals[staff] || 0;
    const pill = document.createElement("span");
    pill.className = "staff-total";

    if (total > DUTY_TARGET_MINUTES) {
      pill.classList.add("over-target");
    } else if (total < DUTY_TARGET_MINUTES) {
      pill.classList.add("under-target");
    }

    pill.innerHTML = `<span>${staff}</span><strong>${total} min</strong>`;
    dutyTotalsElement.append(pill);
  });
}

function createDutyStatus(schedule, consistent) {
  const totals = Object.values(schedule.totals);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const averageText = schedule.averageMinutes.toFixed(1);
  const targetNote =
    schedule.averageMinutes > DUTY_TARGET_MINUTES
      ? `The minimum possible average is ${averageText} minutes, so some staff must exceed 80.`
      : "The target is 80 minutes per staff member.";
  const consistencyNote = consistent
    ? " Consistency was prioritized where it did not break coverage or balance."
    : "";

  return `Duty schedule generated. Totals range ${minTotal}-${maxTotal} minutes. ${targetNote}${consistencyNote}`;
}

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
