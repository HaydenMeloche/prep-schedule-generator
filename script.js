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

let scheduleBody;
let totalsElement;
let statusElement;

if (typeof document !== "undefined") {
  initializePage();
}

if (typeof module !== "undefined") {
  module.exports = {
    generateSchedule,
    validateSchedule,
  };
}

function initializePage() {
  scheduleBody = document.querySelector("#schedule-body");
  totalsElement = document.querySelector("#totals");
  statusElement = document.querySelector("#status");

  document.querySelector("#generate-button").addEventListener("click", () => {
    try {
      const schedule = generateSchedule();
      const validation = validateSchedule(schedule);

      if (!validation.valid) {
        throw new Error(validation.errors.join(" "));
      }

      renderSchedule(schedule);
      renderTotals(validation.totals);
      statusElement.textContent =
        "Prep teacher route generated. Each class has one prep block every day.";
    } catch (error) {
      statusElement.textContent = `Unable to generate a valid schedule: ${error.message}`;
    }
  });

  renderEmptyTable();
  renderTotals(Object.fromEntries(TEACHERS.map((teacher) => [teacher, 0])));
}

function generateSchedule() {
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
