
import { Question, QuestionType, Subject } from '../types';
import * as XLSX from 'xlsx';

const indexToAlpha = (idx: number) => String.fromCharCode(65 + idx);
const alphaToIndex = (alpha: string) => {
  const clean = alpha.trim().toUpperCase();
  if (!clean) return -1;
  return clean.charCodeAt(0) - 65;
};

const formatCorrectAnswer = (q: Question): string => {
  if (q.type === QuestionType.SINGLE) {
    return typeof q.correctAnswer === 'number' ? indexToAlpha(q.correctAnswer) : '-';
  }
  
  if (q.type === QuestionType.MULTIPLE) {
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer
        .map((idx: number) => indexToAlpha(idx))
        .sort()
        .join(', ');
    }
  }
  
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
    if (Array.isArray(q.correctAnswer)) {
      const labels = q.tfLabels || { true: 'B', false: 'S' };
      return q.correctAnswer
        .map((val: boolean) => (val === true ? labels.true[0] : labels.false[0]))
        .join(', ');
    }
  }
  
  return String(q.correctAnswer || '-');
};

const parseCorrectAnswer = (type: QuestionType, val: string): any => {
  if (!val) return null;
  const str = val.toString().trim().toUpperCase();

  if (type === QuestionType.SINGLE) {
    return alphaToIndex(str);
  }

  if (type === QuestionType.MULTIPLE) {
    return str.split(/[,;]/).map(s => alphaToIndex(s.trim())).filter(idx => idx >= 0);
  }

  if (type === QuestionType.MATCH || type === QuestionType.TRUE_FALSE) {
    return str.split(/[,;]/).map(s => {
      const char = s.trim()[0];
      return char === 'B' || char === 'T' || char === 'Y'; // Benar, True, Yes
    });
  }

  return val;
};

const checkCorrectness = (q: Question, studentAnswer: any): boolean => {
  if (studentAnswer === undefined || studentAnswer === null) return false;
  if (q.type === QuestionType.SINGLE) return studentAnswer === q.correctAnswer;
  if (q.type === QuestionType.MULTIPLE) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    const correctSet = new Set(q.correctAnswer);
    const studentSet = new Set(studentAnswer);
    return correctSet.size === studentSet.size && [...correctSet].every(x => studentSet.has(x));
  }
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    return q.correctAnswer.length === studentAnswer.length && q.correctAnswer.every((v:any, i:number) => v === studentAnswer[i]);
  }
  return false;
};

const cleanTextRaw = (text: string): string => {
  if (!text) return '';
  return text.toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
};

export const exportMultiSheetAnalysis = (submissions: any[], questions: Question[], fileName: string) => {
  if (!submissions || submissions.length === 0 || !questions || questions.length === 0) {
    alert("Data tidak lengkap untuk membuat laporan analisis.");
    return;
  }

  // --- SHEET 1: DATA SISWA & JAWABAN ---
  const studentRows = submissions.map((s, idx) => {
    const row: any = {
      'No': idx + 1,
      'Nama Siswa': s.student_name,
      'Kelas': s.class_name,
      'NPSN': s.school_origin || '-',
      'Skor Akhir': s.score.toFixed(1),
      'Waktu Selesai': new Date(s.timestamp).toLocaleString('id-ID'),
    };

    // Tambahkan kolom jawaban per nomor
    questions.forEach((q, qIdx) => {
      const ans = s.answers?.[q.id];
      const isCorrect = checkCorrectness(q, ans);
      const label = `Soal ${qIdx + 1}`;
      
      let displayAns = "";
      if (ans === undefined || ans === null) displayAns = "KOSONG";
      else if (q.type === QuestionType.SINGLE) displayAns = indexToAlpha(ans);
      else displayAns = JSON.stringify(ans);

      row[label] = displayAns;
      row[`Status ${qIdx + 1}`] = isCorrect ? 'BENAR' : 'SALAH';
    });

    return row;
  });

  // --- SHEET 2: REFERENSI SOAL & KUNCI ---
  const questionRows = questions.map((q, idx) => {
    const options = q.options || [];
    const optImages = q.optionImages || [];
    return {
      'No': q.order || idx + 1,
      'ID Soal': q.id,
      'Tipe': q.type,
      'Level': q.level || '-',
      'Butir Pertanyaan': cleanTextRaw(q.text),
      'Gambar Soal (URL)': q.questionImage || '',
      'Opsi A': cleanTextRaw(options[0] || ''),
      'Gambar Opsi A (URL)': optImages[0] || '',
      'Opsi B': cleanTextRaw(options[1] || ''),
      'Gambar Opsi B (URL)': optImages[1] || '',
      'Opsi C': cleanTextRaw(options[2] || ''),
      'Gambar Opsi C (URL)': optImages[2] || '',
      'Opsi D': cleanTextRaw(options[3] || ''),
      'Gambar Opsi D (URL)': optImages[3] || '',
      'Opsi E': cleanTextRaw(options[4] || ''),
      'Gambar Opsi E (URL)': optImages[4] || '',
      'Kunci Jawaban': formatCorrectAnswer(q),
      'Pembahasan': cleanTextRaw(q.explanation || 'Tidak ada pembahasan.')
    };
  });

  // Buat Workbook
  const wb = XLSX.utils.book_new();
  
  const wsStudents = XLSX.utils.json_to_sheet(studentRows);
  const wsQuestions = XLSX.utils.json_to_sheet(questionRows);

  XLSX.utils.book_append_sheet(wb, wsStudents, "HASIL_SISWA");
  XLSX.utils.book_append_sheet(wb, wsQuestions, "REFERENSI_SOAL");

  // Download
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// --- NEW EXCEL V2 FUNCTIONS (MATCHING USER IMAGE) ---

const EXCEL_HEADERS = [
  'No', 'ID Soal', 'Tipe', 'Level', 'Butir Pertanyaan', 'Gambar Soal',
  'Opsi A', 'Gambar Opsi A', 'Opsi B', 'Gambar Opsi B', 
  'Opsi C', 'Gambar Opsi C', 'Opsi D', 'Gambar Opsi D', 
  'Opsi E', 'Gambar Opsi E', 'Kunci Jawaban', 'Pembahasan', 'Token', 'Mata Pelajaran'
];

export const downloadQuestionTemplate = () => {
  const wsData = [EXCEL_HEADERS];
  // Add example row
  wsData.push([
    '1', 'SOAL-001', 'SINGLE', 'L1', 'Apa ibukota Indonesia?', '',
    'Jakarta', '', 'Bandung', '', 'Surabaya', '', 'Medan', '', 'Makassar', '',
    'A', 'Jakarta adalah ibukota negara.', 'TOKEN123', 'PANCASILA'
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Template_Impor_Soal_EPRO.xlsx");
};

export const exportQuestionsToExcelV2 = (questions: Question[], fileName: string) => {
  const rows = questions.map((q, idx) => {
    const options = q.options || [];
    const optImages = q.optionImages || [];
    return [
      (idx + 1).toString(),
      q.id,
      q.type,
      q.level || '-',
      q.text,
      q.questionImage || '',
      options[0] || '', optImages[0] || '',
      options[1] || '', optImages[1] || '',
      options[2] || '', optImages[2] || '',
      options[3] || '', optImages[3] || '',
      options[4] || '', optImages[4] || '',
      formatCorrectAnswer(q),
      q.explanation || '',
      q.quizToken || '',
      q.subject || ''
    ];
  });

  const wsData = [EXCEL_HEADERS, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Data Soal");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const importQuestionsFromExcel = (file: File): Promise<Question[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length < 2) return resolve([]);

        const questions: Question[] = [];
        // Skip header row
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 5) continue;

          const type = (row[2] || 'SINGLE').toString().toUpperCase() as QuestionType;
          const options = [row[6], row[8], row[10], row[12], row[14]].map(v => v?.toString() || '').filter(v => v !== '');
          const optionImages = [row[7], row[9], row[11], row[13], row[15]].map(v => v?.toString() || '');

          const q: Question = {
            id: row[1]?.toString() || `Q-${Date.now()}-${i}`,
            type,
            level: row[3]?.toString() || 'L1',
            text: row[4]?.toString() || '',
            material: '', // Default empty material
            questionImage: row[5]?.toString() || '',
            options: options.length > 0 ? options : undefined,
            optionImages: optionImages.some(v => v !== '') ? optionImages : undefined,
            correctAnswer: parseCorrectAnswer(type, row[16]?.toString() || ''),
            explanation: row[17]?.toString() || '',
            quizToken: row[18]?.toString() || '',
            subject: row[19]?.toString() || Subject.PANCASILA,
            isDeleted: false,
            createdAt: Date.now(),
            order: i
          };
          questions.push(q);
        }
        resolve(questions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const exportSubmissionsToExcel = (submissions: any[], fileName: string, questionBank: Question[] = []) => {
  if (!submissions || submissions.length === 0) return;

  const headers = [
    'No',
    'Nama Lengkap',
    'Kelas',
    'NPSN',
    'ID Token',
    'Mapel',
    'Nilai',
    'Tanggal',
    'Waktu Selesai'
  ];

  const rows = submissions.map((s, idx) => {
    return [
      idx + 1,
      `"${s.student_name}"`,
      `"${s.class_name}"`,
      `"${s.school_origin || '-'}"`,
      `"${s.subject_token || s.subject || '-'}"`,
      `"${s.subject_name || 'Ujian Digital'}"`,
      s.score.toFixed(1),
      new Date(s.timestamp).toLocaleDateString('id-ID'),
      new Date(s.timestamp).toLocaleTimeString('id-ID')
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.click();
};

export const exportFullSubmissionsToCSV = (submissions: any[], fileName: string) => {
    if (!submissions || submissions.length === 0) return;

    const allKeys = new Set<string>();
    submissions.forEach(s => {
        if (s.answers) Object.keys(s.answers).forEach(k => allKeys.add(k));
    });
    const sortedKeys = Array.from(allKeys).sort();

    const headers = [
        'Nama Siswa', 'Kelas', 'NPSN', 'Skor Akhir', 'Waktu Selesai',
        ...sortedKeys.map(k => `Q_${k}`)
    ];

    const rows = submissions.map(s => {
        const answers = s.answers || {};
        const answerCols = sortedKeys.map(k => {
            const ans = answers[k];
            if (ans === undefined || ans === null) return '';
            return `"${JSON.stringify(ans).replace(/"/g, '""')}"`;
        });

        return [
            `"${s.student_name}"`,
            `"${s.class_name}"`,
            `"${s.school_origin || '-'}"`,
            s.score.toFixed(1),
            new Date(s.timestamp).toLocaleString('id-ID'),
            ...answerCols
        ].join(';');
    });

    const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.click();
};
