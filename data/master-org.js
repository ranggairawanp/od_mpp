// Struktur organisasi kosong. Seluruh isinya berasal dari berkas CSV yang diunggah lewat
// layar Impor & Ekspor (masukan Dzuhri nomor 4: tidak ada data dummy di dalam aplikasi).
// Satu-satunya yang tertanam adalah daftar job grade, karena itu struktur, bukan data.
window.NB_DATA = window.NB_DATA || {};
window.NB_DATA.entities = [];
window.NB_DATA.directorates = [];
window.NB_DATA.divisions = [];
window.NB_DATA.departments = [];
window.NB_DATA.cost_centers = [];
window.NB_DATA.grades = [
  { grade_id: "1A", code: "1A", level: 1, label: "General Worker", min: 2800000, mid: 3500000, max: 4375000 },
  { grade_id: "1B", code: "1B", level: 2, label: "General Worker", min: 3120000, mid: 3900000, max: 4875000 },
  { grade_id: "1C", code: "1C", level: 3, label: "General Worker", min: 3440000, mid: 4300000, max: 5375000 },
  { grade_id: "2A", code: "2A", level: 4, label: "Operator", min: 3840000, mid: 4800000, max: 6000000 },
  { grade_id: "2B", code: "2B", level: 5, label: "Operator", min: 4320000, mid: 5400000, max: 6750000 },
  { grade_id: "2C", code: "2C", level: 6, label: "Operator", min: 4800000, mid: 6000000, max: 7500000 },
  { grade_id: "3A", code: "3A", level: 7, label: "Foreman/Staff", min: 5600000, mid: 7000000, max: 8750000 },
  { grade_id: "3B", code: "3B", level: 8, label: "Foreman/Officer", min: 6560000, mid: 8200000, max: 10250000 },
  { grade_id: "3C", code: "3C", level: 9, label: "Foreman/Officer", min: 7680000, mid: 9600000, max: 12000000 },
  { grade_id: "4A", code: "4A", level: 10, label: "Specialist", min: 9200000, mid: 11500000, max: 14375000 },
  { grade_id: "4B", code: "4B", level: 11, label: "Supervisor/Specialist", min: 11200000, mid: 14000000, max: 17500000 },
  { grade_id: "4C", code: "4C", level: 12, label: "Assistant Manager", min: 14400000, mid: 18000000, max: 22500000 },
  { grade_id: "5A", code: "5A", level: 13, label: "Manager", min: 19200000, mid: 24000000, max: 30000000 },
  { grade_id: "5B", code: "5B", level: 14, label: "Senior Manager", min: 25600000, mid: 32000000, max: 40000000 },
  { grade_id: "5C", code: "5C", level: 15, label: "VP", min: 36000000, mid: 45000000, max: 56250000 },
  { grade_id: "6A", code: "6A", level: 16, label: "EVP/VP", min: 52000000, mid: 65000000, max: 81250000 },
  { grade_id: "6B", code: "6B", level: 17, label: "C-Level", min: 76000000, mid: 95000000, max: 118750000 },
  { grade_id: "7", code: "7", level: 18, label: "Group CEO", min: 120000000, mid: 150000000, max: 187500000 }
];
