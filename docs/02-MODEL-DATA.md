# Model data

Bentuk yang dipakai prototipe, sekaligus usulan skema untuk basis data produksi. Field kunci
saja, bukan seluruh kolom.

## Master

| Entitas | Kunci | Field penting | Catatan |
|---|---|---|---|
| Entity | entity_id | name, country, currency | Sudah ada, belum menjadi sumbu lingkup akses |
| Division | division_id | entity_id, name | Tingkat direktorat belum ada, lihat batas nomor 3 |
| Department | department_id | division_id, name, cost_center_id, hod_user_id | Sumbu utama seluruh aplikasi |
| CostCenter | cost_center_id | name, owner_department_id | Menggantikan kebutuhan CoA |
| Grade | grade_id | code, level, label, min, mid, max | 1A sampai 7, level menentukan naik atau turun |
| Position | position_id | code, title, grade_id, department_id, is_unique | |
| Employee | employee_id | name, position_id, grade_id, department_id, employment_status, join_date | |
| User, Role, Scope | user_id | role, scope.type, scope.ids | Produksi: ambil dari direktori, bukan tabel sendiri |

## Snapshot, state Current

| Entitas | Kunci | Field penting | Catatan |
|---|---|---|---|
| OrgSnapshot | snapshot_id | cycle_id, version, effective_date, status, released_by, released_at | Immutable setelah dirilis |
| SnapshotLine | line_id | snapshot_id, employee_id, position_id, department_id, grade_id, current_hc | Disalin dalam, bukan dirujuk |
| Vacancy | vacancy_id | position_id, department_id, grade_id, vacancy_date, source, status | Objek tersendiri, bukan headcount nol |

## Transaksional

| Entitas | Kunci | Field penting | Catatan |
|---|---|---|---|
| MPPCycle | cycle_id | year, start_date, end_date, submission_deadline, status, version, closure_summary | Status: DRAFT, OPEN, LOCKED, CLOSED |
| MPPSubmission | submission_id | cycle_id, department_id, status, version, submitted_at, is_late, review_note | Status: DRAFT, SUBMITTED, RETURNED, OD_ACCEPTED, CONSOLIDATED, APPROVED, DISTRIBUTED |
| MPPLineItem | line_item_id | submission_id, department_id, action_type, employee_id, position_id, vacancy_id, target_grade_id, target_department_id, quantity, effective_month, replacement_flag, vacancy_subtype, fill_immediately, reduction_reason, parent_line_item_id, justification, transfer_status, decision, approved_quantity, version | Inti seluruh sistem |
| CostParameter | param_id | effective_date, tarif iuran, batas upah, thr_x_upah | Bertanggal, tidak pernah ditimpa |
| CostAssumption | assumption_id | effective_date, grades[] berisi komponen per grade | Bertanggal, tidak pernah ditimpa |
| Consolidation | consolidation_id | cycle_id, version, locked_at, per_dept, per_bulan | Catatan beku |
| Approval | approval_id | cycle_id, version, approved_by, approved_at, netto_disetujui, assumption_id | Baseline kendali |
| ApprovedAllocation | allocation_id | cycle_id, approval_id, line_item_id, department_id, action_type, grade_id, effective_month, approved_qty, consumed_qty, remaining_qty, hc_impact, monthly_cost, annualized_cost, status | Tidak ada di dokumen aslinya, lihat catatan di bawah |
| ActualAction | actual_id | allocation_id, department_id, quantity, actual_date, effective_month, status, recorded_by | Status RECORDED atau CANCELLED |
| Exception | exception_id | allocation_id, actual_id, department_id, jenis, kelebihan, status, reason | |

## Jejak

| Entitas | Kunci | Field penting |
|---|---|---|
| AuditLog | audit_id | timestamp, actor, event_type, object_type, object_id, detail_key, detail_vars, before, after |
| RevisionHistory | revision_id | object_type, object_id, field, old_value, new_value, reason, actor, version, timestamp |

Audit mencatat siapa melakukan apa. Revisi mencatat angka bergerak dari berapa ke berapa.
Keduanya sengaja dipisah dan tidak boleh digabung.

## Catatan tentang ApprovedAllocation

Entitas ini tidak ada di dokumen bisnis aslinya. Ditambahkan karena keputusan manajemen
tersimpan terikat sesi review, sedangkan monitoring sepanjang tahun butuh objek yang bisa
dikurangi. Tanpa alokasi sebagai objek tersendiri, sisa kuota harus dihitung ulang dari log
setiap kali layar dibuka, dan angkanya akan berbeda antar layar.

## Catatan tentang pesan audit

`detail_key` dan `detail_vars` disimpan sebagai kunci kamus, bukan kalimat jadi. Ini supaya
log lama tetap terbaca dalam bahasa apa pun tanpa pernah mengubah isi rekamannya.
