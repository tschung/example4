/**
 * ExcelParser - 클라이언트 메모리 기반 엑셀 파일 파서
 * SheetJS(XLSX)를 사용하여 브라우저 로컬에서 안전하게 데이터 추출
 */
class ExcelParser {
    /**
     * File 객체(드래그앤드롭 or input type=file)로부터 파싱
     */
    static async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const parsed = this.extractDataFromWorkbook(workbook, file.name);
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Base64 문자열로부터 파싱 (내장 더미 데이터 로드용)
     */
    static parseBase64(base64Data, filename = 'sensor_sample_data_100.xlsx') {
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const workbook = XLSX.read(bytes, { type: 'array' });
        return this.extractDataFromWorkbook(workbook, filename);
    }

    /**
     * 워크북 객체에서 헤더, 행 데이터, 컬럼 정보 및 타입 추출
     */
    static extractDataFromWorkbook(workbook, filename) {
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 원시 JSON 배열 (헤더 포함)
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        if (!rawJson || rawJson.length === 0) {
            throw new Error('엑셀 파일에 데이터가 비어 있습니다.');
        }

        // 1행: 컬럼 헤더
        const headers = rawJson[0].map((h, idx) => (h !== null && h !== undefined && String(h).trim() !== '') ? String(h).trim() : `열_${idx + 1}`);
        const rows = [];

        for (let i = 1; i < rawJson.length; i++) {
            const rowData = rawJson[i];
            // 빈 행 건너뛰기
            if (!rowData || rowData.every(c => c === null || c === undefined || c === '')) continue;

            const rowObj = {};
            headers.forEach((h, colIdx) => {
                rowObj[h] = rowData[colIdx] !== undefined ? rowData[colIdx] : null;
            });
            rows.push(rowObj);
        }

        // 컬럼별 메타데이터 및 타입 분석
        const columns = headers.map(header => {
            const values = rows.map(r => r[header]).filter(v => v !== null && v !== undefined && v !== '');
            const totalCount = rows.length;
            const validCount = values.length;
            const missingCount = totalCount - validCount;

            // 숫자형 여부 판별
            let numericCount = 0;
            const parsedNums = [];
            values.forEach(v => {
                const num = Number(v);
                if (!isNaN(num) && typeof v !== 'boolean' && String(v).trim() !== '') {
                    numericCount++;
                    parsedNums.push(num);
                }
            });

            const isNumeric = validCount > 0 && (numericCount / validCount) >= 0.8;

            // 고유값(범주 파악용)
            const uniqueValues = Array.from(new Set(values));

            return {
                name: header,
                isNumeric,
                totalCount,
                validCount,
                missingCount,
                uniqueCount: uniqueValues.length,
                uniqueValues: uniqueValues.slice(0, 50),
                rawValues: rows.map(r => r[header]),
                numericValues: isNumeric ? rows.map(r => {
                    const val = Number(r[header]);
                    return (!isNaN(val) && r[header] !== null && r[header] !== '') ? val : null;
                }) : []
            };
        });

        const numericColumns = columns.filter(c => c.isNumeric);
        const categoricalColumns = columns.filter(c => !c.isNumeric || c.uniqueCount <= 10);

        return {
            filename,
            sheetName,
            totalRows: rows.length,
            headers,
            columns,
            numericColumns,
            categoricalColumns,
            rows
        };
    }
}

window.ExcelParser = ExcelParser;
