/* ============================================================
   LeadPredictor — lead generation calculator
   Formulas:
   01) Customers  = Total Revenue / Avg. Order Value
   02) Leads      = Customers * 100 / Lead Response Rate (%)
   03) Prospects  = Leads * 100 / Prospect Response Rate (%)
   ============================================================ */

// ---------- i18n ----------
const I18N = {
  en: {
    language: "Language", currency: "Currency",
    start: "Campaign Start", end: "Campaign End",
    revenue: "Total Revenue", aov: "Avg. Order Value",
    prospects: "Prospects", leads: "Leads", customers: "Customers",
    leadRate: "Lead Response Rate", prospectRate: "Prospect Response Rate",
    month: "Month", people: "people", monthLabel: "Month #",
  },
  bg: {
    language: "Език", currency: "Валута",
    start: "Начало на кампанията", end: "Край на кампанията",
    revenue: "Общ оборот", aov: "Средна стойност на поръчка",
    prospects: "Контакти", leads: "Потенциални клиенти", customers: "Клиенти",
    leadRate: "Процент отговори (потенциални)", prospectRate: "Процент отговори (контакти)",
    month: "Месец", people: "души", monthLabel: "Месец №",
  },
};

const CURRENCY = {
  USD: { symbol: "$" },
  EUR: { symbol: "€" },
  BGN: { symbol: "лв." },
};

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const inputs = {
  language: el("language"),
  currency: el("currency"),
  startDate: el("startDate"),
  endDate: el("endDate"),
  revenue: el("revenue"),
  aov: el("aov"),
  leadRate: el("leadRate"),
  prospectRate: el("prospectRate"),
};

let chart;
let lang = "en";

// ---------- helpers ----------
function monthsBetween(startStr, endStr) {
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (isNaN(s) || isNaN(e) || e <= s) return 6; // sensible fallback
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(1, months);
}

function calcFunnel() {
  const revenue = Math.max(0, Number(inputs.revenue.value) || 0);
  const aov = Math.max(1, Number(inputs.aov.value) || 1);
  const leadRate = Math.max(0.01, Number(inputs.leadRate.value) || 0.01);
  const prospectRate = Math.max(0.01, Number(inputs.prospectRate.value) || 0.01);

  const customers = Math.ceil(revenue / aov);          // Formula 01
  const leads = Math.ceil((customers * 100) / leadRate); // Formula 02
  const prospects = Math.ceil((leads * 100) / prospectRate); // Formula 03

  return { customers, leads, prospects };
}

// ---------- render numbers / cards ----------
function renderCards({ customers, leads, prospects }) {
  el("prospectsValue").textContent = prospects.toLocaleString();
  el("leadsValue").textContent = leads.toLocaleString();
  el("customersValue").textContent = customers.toLocaleString();

  const pLeads = prospects ? Math.round((leads / prospects) * 100) : 0;
  const pCust = prospects ? Math.round((customers / prospects) * 100) : 0;

  el("prospectsPct").textContent = "100%";
  el("leadsPct").textContent = pLeads + "%";
  el("customersPct").textContent = pCust + "%";

  el("prospectsBar").style.width = "100%";
  el("leadsBar").style.width = pLeads + "%";
  el("customersBar").style.width = pCust + "%";
}

// ---------- chart ----------
function buildMonthlyData(funnel, totalMonths) {
  const labels = [];
  const customersSeg = []; // innermost (lightest)
  const leadsSeg = [];     // middle
  const prospectsSeg = []; // outer (darkest)
  const tooltipData = [];  // true cumulative values per month

  for (let m = 1; m <= totalMonths; m++) {
    const c = Math.round((funnel.customers * m) / totalMonths);
    const l = Math.round((funnel.leads * m) / totalMonths);
    const p = Math.round((funnel.prospects * m) / totalMonths);

    labels.push(String(m));
    // Segments stack up to the prospects total per month
    customersSeg.push(c);
    leadsSeg.push(Math.max(0, l - c));
    prospectsSeg.push(Math.max(0, p - l));
    tooltipData.push({ prospects: p, leads: l, customers: c });
  }
  return { labels, customersSeg, leadsSeg, prospectsSeg, tooltipData };
}

function renderChart(funnel) {
  const totalMonths = monthsBetween(inputs.startDate.value, inputs.endDate.value);
  const data = buildMonthlyData(funnel, totalMonths);
  const t = I18N[lang];

  const datasets = [
    { label: t.customers, data: data.customersSeg, backgroundColor: "#e8edf7" },
    { label: t.leads, data: data.leadsSeg, backgroundColor: "#9fb0d2" },
    { label: t.prospects, data: data.prospectsSeg, backgroundColor: "#5d6f99" },
  ];

  if (chart) {
    chart.data.labels = data.labels;
    chart.data.datasets.forEach((ds, i) => {
      ds.data = datasets[i].data;
      ds.label = datasets[i].label;
    });
    chart._tooltipData = data.tooltipData;
    chart.options.scales.x.title.text = t.people;
    chart.options.scales.y.title.text = t.month + "s";
    chart.update();
    return;
  }

  const ctx = el("funnelChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "bar",
    data: { labels: data.labels, datasets },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      scales: {
        x: {
          stacked: true,
          grid: { color: "rgba(148,163,184,0.10)" },
          ticks: {
            color: "#8a99b5",
            callback: (v) => v + " " + I18N[lang].people,
          },
          title: { display: false, text: t.people },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "#8a99b5" },
          title: { display: true, text: t.month + "s", color: "#8a99b5" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(20,30,52,0.96)",
          borderColor: "rgba(148,163,184,0.3)",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) =>
              I18N[lang].monthLabel + items[0].label,
            label: () => "",
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const d = chart._tooltipData[idx];
              const tt = I18N[lang];
              return [
                `${tt.prospects}: ${d.prospects}`,
                `${tt.leads}: ${d.leads}`,
                `${tt.customers}: ${d.customers}`,
              ];
            },
          },
        },
      },
    },
  });
  chart._tooltipData = data.tooltipData;
}

// ---------- language / currency ----------
function applyLanguage() {
  lang = inputs.language.value;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (I18N[lang][key]) node.textContent = I18N[lang][key];
  });
}

function applyCurrency() {
  const sym = CURRENCY[inputs.currency.value].symbol;
  document.querySelectorAll("[data-currency-symbol]").forEach((n) => {
    n.textContent = sym;
  });
}

// ---------- sliders ----------
function updateSliderUI(input, outId) {
  const min = Number(input.min), max = Number(input.max);
  const pct = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--fill", pct + "%");
  el(outId).textContent = Number(input.value).toFixed(2) + "%";
}

// ---------- main update ----------
function update() {
  applyCurrency();
  updateSliderUI(inputs.leadRate, "leadRateOut");
  updateSliderUI(inputs.prospectRate, "prospectRateOut");

  const funnel = calcFunnel();
  renderCards(funnel);
  renderChart(funnel);
}

// ---------- listeners ----------
function init() {
  applyLanguage();
  ["revenue", "aov", "startDate", "endDate", "leadRate", "prospectRate", "currency"].forEach(
    (k) => inputs[k].addEventListener("input", update)
  );
  inputs.language.addEventListener("change", () => {
    applyLanguage();
    update();
  });
  update();
}

document.addEventListener("DOMContentLoaded", init);
