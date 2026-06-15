"use strict";

const METHOD_NAMES = {
  "middle-square": "중앙제곱법",
  lcg: "선형 합동법",
  "xor-shift": "XOR 시프트"
};

const cards = [...document.querySelectorAll(".experiment-card")];
const experimentResults = new Map();
let seedSequence = 0;

function createSeed() {
  seedSequence += 1;
  const timePart = Date.now() >>> 0;
  const performancePart = Math.floor(performance.now() * 1000) >>> 0;
  return (timePart ^ performancePart ^ Math.imul(seedSequence, 0x9e3779b9)) >>> 0 || 1;
}

function createMiddleSquare(seed) {
  let state = seed % 100000000;

  if (state < 10000000) {
    state += 10000000;
  }

  return function next() {
    const squared = BigInt(state) * BigInt(state);
    const padded = squared.toString().padStart(16, "0");
    state = Number(padded.slice(4, 12));

    if (state === 0) {
      state = ((seed ^ 0x6d2b79f5) + seedSequence) % 90000000 + 10000000;
    }

    return state / 100000000;
  };
}

function createLcg(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createXorShift(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;

  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function getGenerator(method, seed) {
  if (method === "middle-square") {
    return createMiddleSquare(seed);
  }

  if (method === "lcg") {
    return createLcg(seed);
  }

  return createXorShift(seed);
}

function readSettings(card) {
  return {
    iterations: Number(card.querySelector('[name="iterations"]').value),
    min: Number(card.querySelector('[name="min"]').value),
    max: Number(card.querySelector('[name="max"]').value)
  };
}

function validateSettings(settings) {
  if (!Number.isInteger(settings.iterations) || settings.iterations < 1 || settings.iterations > 100000) {
    return "실행 횟수는 1~100,000 사이의 정수여야 합니다.";
  }

  if (!Number.isInteger(settings.min) || !Number.isInteger(settings.max)) {
    return "최소값과 최대값은 정수여야 합니다.";
  }

  if (settings.min >= settings.max) {
    return "최대값은 최소값보다 커야 합니다.";
  }

  if (settings.max - settings.min + 1 > 100) {
    return "그래프 가독성을 위해 범위는 100개 이하로 설정해 주세요.";
  }

  return "";
}

function showError(card, message) {
  const error = card.querySelector(".input-error");
  error.textContent = message;
  error.classList.toggle("visible", Boolean(message));
}

function generateDistribution(method, settings, seed) {
  const range = settings.max - settings.min + 1;
  const counts = Array(range).fill(0);
  const next = getGenerator(method, seed);

  for (let index = 0; index < settings.iterations; index += 1) {
    const value = settings.min + Math.floor(next() * range);
    counts[value - settings.min] += 1;
  }

  return counts;
}

function calculateDeviation(counts, iterations) {
  const expected = iterations / counts.length;
  const absoluteDifference = counts.reduce(
    (sum, count) => sum + Math.abs(count - expected),
    0
  );

  return (absoluteDifference / counts.length / expected) * 100;
}

function renderChart(card, counts, min) {
  const chart = card.querySelector(".chart");
  const maximumCount = Math.max(...counts, 1);

  chart.replaceChildren();

  counts.forEach((count, index) => {
    const item = document.createElement("div");
    const value = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("div");
    const label = document.createElement("span");

    item.className = "bar-item";
    value.className = "bar-value";
    track.className = "bar-track";
    fill.className = "bar-fill";
    label.className = "bar-label";

    value.textContent = count.toLocaleString("ko-KR");
    label.textContent = String(min + index);
    track.append(fill);
    item.append(value, track, label);
    chart.append(item);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.height = `${(count / maximumCount) * 100}%`;
      });
    });
  });
}

function updateComparison() {
  if (experimentResults.size === 0) {
    return;
  }

  const results = [...experimentResults.entries()].map(([method, deviation]) => ({
    method,
    deviation
  }));
  const winner = results.reduce((best, current) =>
    current.deviation < best.deviation ? current : best
  );

  document.querySelector("#winner-name").textContent = METHOD_NAMES[winner.method];
}

function runExperiment(card) {
  const settings = readSettings(card);
  const validationMessage = validateSettings(settings);

  showError(card, validationMessage);

  if (validationMessage) {
    return;
  }

  const method = card.dataset.algorithm;
  const counts = generateDistribution(method, settings, createSeed());
  const deviation = calculateDeviation(counts, settings.iterations);

  renderChart(card, counts, settings.min);
  card.querySelector(".deviation strong").textContent = `${deviation.toFixed(1)}%`;
  document.querySelector(`[data-result="${method}"]`).textContent =
    `편차 ${deviation.toFixed(1)}%`;
  experimentResults.set(method, deviation);
  updateComparison();
}

cards.forEach((card) => {
  card.querySelector(".run-button").addEventListener("click", () => {
    runExperiment(card);
  });

  runExperiment(card);
});
