// Satu akun administrator bawaan (K7). Hanya boleh mengunggah struktur dan pengguna,
// dan tidak bisa dihapus. Pengguna lain diunggah lewat berkas 04-pengguna; HOD dan manajer
// diturunkan otomatis dari pohon atasan langsung.
window.NB_DATA = window.NB_DATA || {};
window.NB_DATA.users = [
  { user_id: "U-ADMIN", name: "Administrator", email: "admin@lokal",
    role: "ADMIN", title: "Akun bawaan", scope: { type: "ALL" }, bawaan: true }
];
