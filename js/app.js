/**
 * App - 대시보드 전체 UI 상호작용 및 통계 분석 모듈 오케스트레이션
 */
document.addEventListener('DOMContentLoaded', () => {
    // 상태 변수
    let currentData = null;
    let isDarkMode = true;
    const chartManager = new ChartManager();

    // DOM 요소
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const loadDefaultBtn = document.getElementById('loadDefaultBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 테마 토글
    themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        themeToggleBtn.innerHTML = isDarkMode 
            ? '<i class="fa-solid fa-moon"></i> 다크 모드' 
            : '<i class="fa-solid fa-sun"></i> 라이트 모드';
        
        // 차트 전체 다시 그리기
        if (currentData) {
            refreshActiveTab();
        }
    });

    // 탭 전환
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) targetContent.classList.add('active');

            if (currentData) {
                renderTabContent(targetTab);
            }
        });
    });

    // 드래그앤드롭 이벤트 바인딩
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 내장 기본 더미 데이터 로드
    loadDefaultBtn.addEventListener('click', () => {
        loadDefaultDataset();
    });

    // 파일 로드 핸들러
    async function handleFile(file) {
        try {
            showNotification('엑셀 데이터를 로컬 메모리에서 분석 중...', 'info');
            const parsed = await ExcelParser.parseFile(file);
            processData(parsed);
        } catch (err) {
            alert('파일 읽기 오류: ' + err.message);
        }
    }

    // 기본 데이터셋 로드
    function loadDefaultDataset() {
        if (window.DEFAULT_EXCEL_B64) {
            try {
                const parsed = ExcelParser.parseBase64(window.DEFAULT_EXCEL_B64, 'sensor_sample_data_100.xlsx');
                processData(parsed);
            } catch (e) {
                alert('기본 데이터 로드 실패: ' + e.message);
            }
        } else {
            alert('기본 데이터셋이 준비되지 않았습니다.');
        }
    }

    // 데이터 파싱 후 메타정보 렌더링 및 UI 초기화
    function processData(parsed) {
        currentData = parsed;

        // 메타 카드 업데이트
        document.getElementById('metaFilename').textContent = parsed.filename;
        document.getElementById('metaRowCount').textContent = `${parsed.totalRows} 행`;
        document.getElementById('metaColCount').textContent = `${parsed.columns.length} 개`;

        const missingTotal = parsed.columns.reduce((acc, c) => acc + c.missingCount, 0);
        document.getElementById('metaMissingCount').textContent = `${missingTotal} 개`;

        const numCols = parsed.numericColumns.length;
        document.getElementById('metaNumericColCount').textContent = `${numCols} 개`;

        // 컨트롤 드롭다운 초기화
        populateSelectOptions();

        // 현재 활성 탭 렌더링
        refreshActiveTab();

        showNotification('데이터 분석 준비 완료! 모든 통계가 실시간 연산되었습니다.', 'success');
    }

    function populateSelectOptions() {
        if (!currentData) return;

        // 기술통계 변수 선택기
        const descVarSelect = document.getElementById('descVarSelect');
        descVarSelect.innerHTML = currentData.numericColumns.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        // 회귀분석 X, Y 선택기
        const regXSelect = document.getElementById('regXSelect');
        const regYSelect = document.getElementById('regYSelect');
        const numOptions = currentData.numericColumns.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        regXSelect.innerHTML = numOptions;
        regYSelect.innerHTML = numOptions;

        // 스마트 기본값 매핑
        if (currentData.numericColumns.some(c => c.name.includes('원시값'))) {
            regXSelect.value = currentData.numericColumns.find(c => c.name.includes('원시값')).name;
        }
        if (currentData.numericColumns.some(c => c.name.includes('참값'))) {
            regYSelect.value = currentData.numericColumns.find(c => c.name.includes('참값')).name;
        } else if (currentData.numericColumns.length > 1) {
            regYSelect.selectedIndex = 1;
        }

        // 이상치 감지 변수 선택기
        const anomalyVarSelect = document.getElementById('anomalyVarSelect');
        anomalyVarSelect.innerHTML = numOptions;

        // 가설검정 그룹/변수 선택기
        const ttestVarSelect = document.getElementById('ttestVarSelect');
        const ttestGroupSelect = document.getElementById('ttestGroupSelect');
        ttestVarSelect.innerHTML = numOptions;
        
        const catOptions = currentData.categoricalColumns.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        ttestGroupSelect.innerHTML = catOptions || `<option value="">범주형 변수 없음</option>`;

        // 이벤트 리스너 재부착
        descVarSelect.onchange = () => renderDescriptiveStats();
        regXSelect.onchange = () => renderRegression();
        regYSelect.onchange = () => renderRegression();
        anomalyVarSelect.onchange = () => renderAnomalyDetection();
        document.getElementById('zScoreThreshold').onchange = () => renderAnomalyDetection();
        ttestVarSelect.onchange = () => renderHypothesisTesting();
        ttestGroupSelect.onchange = () => renderHypothesisTesting();
        document.getElementById('testTypeSelect').onchange = () => renderHypothesisTesting();
    }

    function refreshActiveTab() {
        const activeBtn = document.querySelector('.tab-btn.active');
        if (activeBtn) {
            renderTabContent(activeBtn.getAttribute('data-tab'));
        }
    }

    function renderTabContent(tabId) {
        if (!currentData) return;

        switch (tabId) {
            case 'tab-overview':
                renderDataOverview();
                break;
            case 'tab-descriptive':
                renderDescriptiveStats();
                break;
            case 'tab-timeseries':
                renderTimeSeriesMonitor();
                break;
            case 'tab-sensor-error':
                renderSensorError();
                break;
            case 'tab-correlation':
                renderCorrelationMatrix();
                break;
            case 'tab-regression':
                renderRegression();
                break;
            case 'tab-hypothesis':
                renderHypothesisTesting();
                break;
            case 'tab-anomaly':
                renderAnomalyDetection();
                break;
        }
    }

    /* 1. 데이터 미리보기 및 현황 */
    function renderDataOverview() {
        const previewTableHead = document.getElementById('previewTableHead');
        const previewTableBody = document.getElementById('previewTableBody');

        previewTableHead.innerHTML = `<tr><th>#</th>` + currentData.headers.map(h => `<th>${h}</th>`).join('') + `</tr>`;

        // 상위 50개 행만 렌더링
        const previewRows = currentData.rows.slice(0, 50);
        previewTableBody.innerHTML = previewRows.map((r, idx) => {
            return `<tr><td>${idx + 1}</td>` + currentData.headers.map(h => {
                const val = r[h];
                if (h === '이벤트' || typeof val === 'string') {
                    let badgeClass = 'badge-normal';
                    if (val === '경고' || val === '주의') badgeClass = 'badge-warning';
                    if (val === '이상치' || val === '위험') badgeClass = 'badge-danger';
                    return `<td><span class="badge-tag ${badgeClass}">${val !== null ? val : '-'}</span></td>`;
                }
                return `<td>${typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 3 }) : (val !== null ? val : '-')}</td>`;
            }).join('') + `</tr>`;
        }).join('');
    }

    /* 2. 기술통계량 요약 */
    function renderDescriptiveStats() {
        const selectedColName = document.getElementById('descVarSelect').value;
        const col = currentData.columns.find(c => c.name === selectedColName);
        if (!col || !col.isNumeric) return;

        const stats = StatsEngine.describe(col.numericValues);
        if (!stats) return;

        // 통계 카드 채우기
        const statsSummary = document.getElementById('statsSummaryCards');
        statsSummary.innerHTML = `
            <div class="metric-card">
                <span class="metric-title">데이터 수 (N)</span>
                <span class="metric-value">${stats.count}</span>
                <span class="metric-desc">결측치: ${col.missingCount} 건</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">평균 (Mean)</span>
                <span class="metric-value">${stats.mean.toFixed(3)}</span>
                <span class="metric-desc">표준오차: ${(stats.stdDev / Math.sqrt(stats.count)).toFixed(3)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">중앙값 (Median)</span>
                <span class="metric-value">${stats.median.toFixed(3)}</span>
                <span class="metric-desc">최빈값: ${stats.mode.toFixed(2)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">표준편차 (Std Dev)</span>
                <span class="metric-value">${stats.stdDev.toFixed(3)}</span>
                <span class="metric-desc">분산: ${stats.variance.toFixed(3)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">범위 (Min ~ Max)</span>
                <span class="metric-value">${stats.min.toFixed(2)} ~ ${stats.max.toFixed(2)}</span>
                <span class="metric-desc">Range: ${stats.range.toFixed(2)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">사분위수 범위 (IQR)</span>
                <span class="metric-value">${stats.iqr.toFixed(3)}</span>
                <span class="metric-desc">Q1: ${stats.q1.toFixed(2)} | Q3: ${stats.q3.toFixed(2)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">왜도 (Skewness)</span>
                <span class="metric-value">${stats.skewness.toFixed(3)}</span>
                <span class="metric-desc">${Math.abs(stats.skewness) < 0.5 ? '대칭적 분포' : (stats.skewness > 0 ? '오른쪽 꼬리 비대칭' : '왼쪽 꼬리 비대칭')}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">첨도 (Kurtosis)</span>
                <span class="metric-value">${stats.kurtosis.toFixed(3)}</span>
                <span class="metric-desc">${Math.abs(stats.kurtosis) < 1 ? '정규분포 유사' : (stats.kurtosis > 0 ? '뾰족한 첨두' : '평평한 분포')}</span>
            </div>
        `;

        // 전체 수치형 컬럼 비교 테이블
        const allDescTableBody = document.getElementById('allDescTableBody');
        allDescTableBody.innerHTML = currentData.numericColumns.map(nc => {
            const st = StatsEngine.describe(nc.numericValues);
            if (!st) return '';
            return `
                <tr>
                    <td><strong>${nc.name}</strong></td>
                    <td>${st.count}</td>
                    <td>${st.mean.toFixed(3)}</td>
                    <td>${st.median.toFixed(3)}</td>
                    <td>${st.stdDev.toFixed(3)}</td>
                    <td>${st.min.toFixed(2)}</td>
                    <td>${st.max.toFixed(2)}</td>
                    <td>${st.q1.toFixed(2)}</td>
                    <td>${st.q3.toFixed(2)}</td>
                    <td>${st.iqr.toFixed(2)}</td>
                    <td>${st.skewness.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        // 히스토그램 차트 렌더링
        chartManager.renderHistogram('descHistChart', col.numericValues, col.name, 14, isDarkMode);
    }

    /* 3. 시계열 트렌드 모니터링 */
    function renderTimeSeriesMonitor() {
        const timeCol = currentData.columns.find(c => c.name.includes('시각') || c.name.includes('시간') || c.name.toLowerCase().includes('time')) || currentData.columns[0];
        const timeLabels = timeCol.rawValues.map(v => String(v));

        const datasets = currentData.numericColumns
            .filter(c => c !== timeCol && !c.name.includes('경과시간'))
            .map(c => ({
                label: c.name,
                data: c.numericValues
            }));

        chartManager.renderTimeSeries('timeSeriesChart', timeLabels, datasets, isDarkMode);
    }

    /* 4. 센서 오차 및 정밀도 분석 (원시값 vs 참값) */
    function renderSensorError() {
        const rawCol = currentData.columns.find(c => c.name.includes('원시값') || c.name.includes('측정값'));
        const trueCol = currentData.columns.find(c => c.name.includes('참값') || c.name.includes('기준') || c.name.includes('비교'));

        const errorContent = document.getElementById('sensorErrorContent');

        if (!rawCol || !trueCol) {
            errorContent.innerHTML = `<div class="hypothesis-box insignificant">현재 데이터셋에서 비교할 '원시값'과 '참값/비교용' 수치형 컬럼을 자동으로 특정할 수 없습니다.</div>`;
            return;
        }

        const evalResult = StatsEngine.evaluateSensorError(rawCol.numericValues, trueCol.numericValues);
        if (!evalResult) return;

        const timeCol = currentData.columns[0];
        const labels = timeCol.rawValues.map((v, i) => v ? String(v) : `P_${i + 1}`);

        document.getElementById('sensorErrorMetrics').innerHTML = `
            <div class="metric-card">
                <span class="metric-title">평균 절대 오차 (MAE)</span>
                <span class="metric-value">${evalResult.mae.toFixed(4)} °C</span>
                <span class="metric-desc">오차 크기의 절대적 평균</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">평균 제곱근 오차 (RMSE)</span>
                <span class="metric-value">${evalResult.rmse.toFixed(4)} °C</span>
                <span class="metric-desc">큰 오차에 가중치 부여 지표</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">평균 편향 (Sensor Bias)</span>
                <span class="metric-value" style="color: ${evalResult.bias >= 0 ? '#38bdf8' : '#f43f5e'}">${evalResult.bias.toFixed(4)} °C</span>
                <span class="metric-desc">${evalResult.bias >= 0 ? '원시값이 참값보다 높게 측정되는 경향' : '원시값이 참값보다 낮게 측정되는 경향'}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">최대 절대 오차 (Max Error)</span>
                <span class="metric-value">${evalResult.maxErr.toFixed(4)} °C</span>
                <span class="metric-desc">단일 최대 편차 크기</span>
            </div>
        `;

        if (evalResult.pairedT) {
            const p = evalResult.pairedT;
            document.getElementById('sensorErrorTTest').innerHTML = `
                <div class="hypothesis-box ${p.isSignificant ? 'significant' : 'insignificant'}">
                    <strong>대응표본 t-검정 결과 (센서 원시값 vs 참값):</strong><br>
                    t-통계량 = <strong>${p.tStat.toFixed(4)}</strong>, 자유도(df) = <strong>${p.df}</strong>, p-value = <strong>${p.pValue < 0.001 ? '< 0.001' : p.pValue.toFixed(4)}</strong><br>
                    ${p.isSignificant 
                        ? `<span style="color: var(--warning);">유의수준 0.05 기준 통계적으로 유의미한 센서 캘리브레이션 편차(Bias)가 존재합니다. 보정이 권장됩니다.</span>` 
                        : `<span style="color: var(--success);">유의수준 0.05 기준 원시값과 참값 간에 통계적으로 유의한 차이가 발견되지 않았습니다. 센서 정밀도가 우수합니다.</span>`}
                </div>
            `;
        }

        chartManager.renderResiduals('sensorResidualChart', labels, evalResult.errors, isDarkMode);
    }

    /* 5. 피어슨 상관분석 매트릭스 및 인터랙티브 산점도 */
    function renderCorrelationMatrix() {
        const numCols = currentData.numericColumns;
        if (numCols.length < 2) return;

        const container = document.getElementById('correlationTableContainer');
        let html = `<table class="heatmap-table"><thead><tr><th>변수명</th>`;
        numCols.forEach(c => html += `<th>${c.name}</th>`);
        html += `</tr></thead><tbody>`;

        const matrix = [];
        numCols.forEach((rowCol, rIdx) => {
            html += `<tr><td><strong>${rowCol.name}</strong></td>`;
            matrix[rIdx] = [];
            numCols.forEach((colCol, cIdx) => {
                const res = StatsEngine.pearsonCorrelation(rowCol.numericValues, colCol.numericValues);
                matrix[rIdx][cIdx] = res.r;
                const r = res.r;
                
                // 히트맵 컬러 계산 (-1: Red, 0: Neutral, +1: Blue)
                let bgColor = 'transparent';
                let textColor = isDarkMode ? '#f1f5f9' : '#0f172a';
                if (r > 0) {
                    bgColor = `rgba(56, 189, 248, ${Math.min(1, Math.abs(r) * 0.85 + 0.1)})`;
                } else if (r < 0) {
                    bgColor = `rgba(244, 63, 94, ${Math.min(1, Math.abs(r) * 0.85 + 0.1)})`;
                }
                if (Math.abs(r) > 0.6) textColor = '#ffffff';

                html += `<td class="heatmap-cell" style="background-color: ${bgColor}; color: ${textColor}; cursor: pointer;" 
                    onclick="window.selectCorrPair('${rowCol.name}', '${colCol.name}')"
                    title="${rowCol.name} vs ${colCol.name} (r=${r.toFixed(3)}, p=${res.pValue < 0.001 ? '<0.001' : res.pValue.toFixed(3)})">
                    ${r.toFixed(2)}
                </td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;

        // 상관관계 상세 차트 (기본값: 처음 두 변수)
        window.selectCorrPair = (nameX, nameY) => {
            const colX = currentData.columns.find(c => c.name === nameX);
            const colY = currentData.columns.find(c => c.name === nameY);
            if (!colX || !colY) return;

            const pairs = [];
            for (let i = 0; i < Math.min(colX.numericValues.length, colY.numericValues.length); i++) {
                if (colX.numericValues[i] !== null && colY.numericValues[i] !== null) {
                    pairs.push({ x: colX.numericValues[i], y: colY.numericValues[i] });
                }
            }

            const reg = StatsEngine.linearRegression(colX.numericValues, colY.numericValues);
            let regLine = [];
            if (reg) {
                const xs = pairs.map(p => p.x);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                regLine = [
                    { x: minX, y: reg.slope * minX + reg.intercept, slope: reg.slope, intercept: reg.intercept },
                    { x: maxX, y: reg.slope * maxX + reg.intercept, slope: reg.slope, intercept: reg.intercept }
                ];
            }

            chartManager.renderScatterRegression('corrScatterChart', pairs, regLine, nameX, nameY, isDarkMode);
            document.getElementById('corrPairTitle').textContent = `상관 산점도: ${nameX} ↔ ${nameY}`;
        };

        if (numCols.length >= 2) {
            window.selectCorrPair(numCols[0].name, numCols[1].name);
        }
    }

    /* 6. 선형 회귀분석 */
    function renderRegression() {
        const xName = document.getElementById('regXSelect').value;
        const yName = document.getElementById('regYSelect').value;
        const colX = currentData.columns.find(c => c.name === xName);
        const colY = currentData.columns.find(c => c.name === yName);
        if (!colX || !colY) return;

        const reg = StatsEngine.linearRegression(colX.numericValues, colY.numericValues);
        if (!reg) return;

        document.getElementById('regMetrics').innerHTML = `
            <div class="metric-card">
                <span class="metric-title">회귀 방정식</span>
                <span class="metric-value" style="font-size: 1.05rem;">y = ${reg.slope.toFixed(4)}x ${reg.intercept >= 0 ? '+' : '-'} ${Math.abs(reg.intercept).toFixed(4)}</span>
                <span class="metric-desc">기울기: ${reg.slope.toFixed(4)} | 절편: ${reg.intercept.toFixed(4)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">결정계수 (R² Score)</span>
                <span class="metric-value">${(reg.rSquared * 100).toFixed(2)} %</span>
                <span class="metric-desc">설명력: R² = ${reg.rSquared.toFixed(4)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">상관계수 (r)</span>
                <span class="metric-value">${reg.r.toFixed(4)}</span>
                <span class="metric-desc">피어슨 상관계수</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">t-통계량 & p-value</span>
                <span class="metric-value">${reg.pValue < 0.001 ? 'p < 0.001' : 'p = ' + reg.pValue.toFixed(4)}</span>
                <span class="metric-desc">t = ${reg.tStat.toFixed(3)} (${reg.pValue < 0.05 ? '통계적 유의' : '유의하지 않음'})</span>
            </div>
        `;

        const pairs = [];
        for (let i = 0; i < Math.min(colX.numericValues.length, colY.numericValues.length); i++) {
            if (colX.numericValues[i] !== null && colY.numericValues[i] !== null) {
                pairs.push({ x: colX.numericValues[i], y: colY.numericValues[i] });
            }
        }

        const xs = pairs.map(p => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const regLine = [
            { x: minX, y: reg.slope * minX + reg.intercept, slope: reg.slope, intercept: reg.intercept },
            { x: maxX, y: reg.slope * maxX + reg.intercept, slope: reg.slope, intercept: reg.intercept }
        ];

        chartManager.renderScatterRegression('regressionChart', pairs, regLine, xName, yName, isDarkMode);
    }

    /* 7. 추론 통계 및 가설 검정 (t-검정 / ANOVA) */
    function renderHypothesisTesting() {
        const testType = document.getElementById('testTypeSelect').value;
        const varName = document.getElementById('ttestVarSelect').value;
        const groupName = document.getElementById('ttestGroupSelect').value;

        const valCol = currentData.columns.find(c => c.name === varName);
        const grpCol = currentData.columns.find(c => c.name === groupName);

        const container = document.getElementById('hypothesisResultContainer');

        if (!valCol || !grpCol) {
            container.innerHTML = `<div class="hypothesis-box insignificant">분석할 수치형 변수와 그룹 변수를 선택해 주세요.</div>`;
            return;
        }

        // 그룹별 수치 데이터 분리
        const groups = {};
        for (let i = 0; i < currentData.rows.length; i++) {
            const grpVal = String(currentData.rows[i][groupName] || '미분류');
            const numVal = valCol.numericValues[i];
            if (numVal !== null && !isNaN(numVal)) {
                if (!groups[grpVal]) groups[grpVal] = [];
                groups[grpVal].push(numVal);
            }
        }

        const groupKeys = Object.keys(groups);

        if (testType === 'two-sample-t') {
            if (groupKeys.length < 2) {
                container.innerHTML = `<div class="hypothesis-box insignificant">독립 2표본 t-검정을 수행하려면 그룹 변수의 고유 범주가 2개 이상이어야 합니다.</div>`;
                return;
            }

            const g1 = groupKeys[0];
            const g2 = groupKeys[1];
            const res = StatsEngine.independentTTest(groups[g1], groups[g2]);

            if (!res) {
                container.innerHTML = `<div class="hypothesis-box insignificant">표본 크기가 부족하여 검정을 수행할 수 없습니다.</div>`;
                return;
            }

            container.innerHTML = `
                <div class="hypothesis-box ${res.isSignificant ? 'significant' : 'insignificant'}">
                    <h4><i class="fa-solid fa-scale-balanced"></i> 독립 2표본 t-검정 결과 [Welch's t-test]</h4>
                    <p><strong>비교 집단:</strong> [${g1}] (평균: ${res.meanA.toFixed(3)}, N=${groups[g1].length}) vs [${g2}] (평균: ${res.meanB.toFixed(3)}, N=${groups[g2].length})</p>
                    <p><strong>평균 차이:</strong> ${res.diff.toFixed(3)}</p>
                    <p><strong>검정 통계량:</strong> t = <strong>${res.tStat.toFixed(4)}</strong>, 유효 자유도(df) = <strong>${res.df.toFixed(2)}</strong></p>
                    <p><strong>유의확률 (p-value):</strong> <strong>${res.pValue < 0.001 ? '< 0.001' : res.pValue.toFixed(4)}</strong></p>
                    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.6rem 0;">
                    <p><strong>결론 판정:</strong> ${res.isSignificant 
                        ? `<span style="color: var(--success); font-weight: 600;">귀무가설 기각 (p < 0.05). 집단 간 [${varName}]의 평균 차이가 통계적으로 유의미합니다.</span>` 
                        : `<span style="color: var(--warning); font-weight: 600;">귀무가설 채택 (p >= 0.05). 집단 간 [${varName}]의 평균 차이가 통계적으로 유의하지 않습니다.</span>`}</p>
                </div>
            `;
        } else if (testType === 'anova') {
            const res = StatsEngine.oneWayANOVA(groups);
            if (!res) {
                container.innerHTML = `<div class="hypothesis-box insignificant">ANOVA 분석을 위한 집단 수 또는 표본 수가 부족합니다.</div>`;
                return;
            }

            let groupListHtml = Object.keys(res.groupStats).map(k => {
                const g = res.groupStats[k];
                return `<li><strong>${k}</strong>: 평균 = ${g.mean.toFixed(3)}, 표본 수 = ${g.n}</li>`;
            }).join('');

            container.innerHTML = `
                <div class="hypothesis-box ${res.isSignificant ? 'significant' : 'insignificant'}">
                    <h4><i class="fa-solid fa-chart-pie"></i> 일원배치 분산분석 (One-way ANOVA) 결과</h4>
                    <ul style="margin: 0.5rem 0 0.5rem 1.2rem; font-size: 0.82rem;">
                        ${groupListHtml}
                    </ul>
                    <p><strong>집단 간 제곱합 (SSB):</strong> ${res.ssBetween.toFixed(3)} (자유도: ${res.dfBetween})</p>
                    <p><strong>집단 내 제곱합 (SSW):</strong> ${res.ssWithin.toFixed(3)} (자유도: ${res.dfWithin})</p>
                    <p><strong>F-통계량:</strong> <strong>${res.fStat.toFixed(4)}</strong>, <strong>p-value:</strong> <strong>${res.pValue < 0.001 ? '< 0.001' : res.pValue.toFixed(4)}</strong></p>
                    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.6rem 0;">
                    <p><strong>결론 판정:</strong> ${res.isSignificant 
                        ? `<span style="color: var(--success); font-weight: 600;">귀무가설 기각 (p < 0.05). 적어도 한 집단의 [${varName}] 평균이 다른 집단과 유의미하게 다릅니다.</span>` 
                        : `<span style="color: var(--warning); font-weight: 600;">귀무가설 채택 (p >= 0.05). 모든 집단의 [${varName}] 평균에 유의한 차이가 없습니다.</span>`}</p>
                </div>
            `;
        }
    }

    /* 8. 이상치 감지 및 Shewhart 관리도 */
    function renderAnomalyDetection() {
        const varName = document.getElementById('anomalyVarSelect').value;
        const zThresh = parseFloat(document.getElementById('zScoreThreshold').value) || 2.5;

        const col = currentData.columns.find(c => c.name === varName);
        if (!col || !col.isNumeric) return;

        const res = StatsEngine.detectAnomalies(col.numericValues, { zThreshold: zThresh, iqrMultiplier: 1.5 });
        if (!res) return;

        // 메트릭 표시
        document.getElementById('anomalyMetrics').innerHTML = `
            <div class="metric-card">
                <span class="metric-title">탐지된 이상치 건수</span>
                <span class="metric-value" style="color: ${res.anomalies.length > 0 ? '#ef4444' : '#10b981'};">${res.anomalies.length} 건</span>
                <span class="metric-desc">전체 데이터 대비 이상치 비율: ${res.anomalyRate.toFixed(2)}%</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">Shewhart 중심선 (CL)</span>
                <span class="metric-value">${res.cl.toFixed(3)}</span>
                <span class="metric-desc">표준편차 (σ): ${res.stats.stdDev.toFixed(3)}</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">관리 상한선 (UCL)</span>
                <span class="metric-value">${res.ucl.toFixed(3)}</span>
                <span class="metric-desc">CL + 3σ (또는 IQR 상한: ${res.iqrUpper.toFixed(2)})</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">관리 하한선 (LCL)</span>
                <span class="metric-value">${res.lcl.toFixed(3)}</span>
                <span class="metric-desc">CL - 3σ (또는 IQR 하한: ${res.iqrLower.toFixed(2)})</span>
            </div>
        `;

        // 이상치 테이블
        const tbody = document.getElementById('anomalyTableBody');
        if (res.anomalies.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--success); padding: 1rem;">지정된 임계치 기준 이상치가 감지되지 않았습니다.</td></tr>`;
        } else {
            tbody.innerHTML = res.anomalies.map(a => {
                const row = currentData.rows[a.index];
                const timeVal = row['측정시각'] || row['시간'] || `행 #${a.index + 1}`;
                const eventVal = row['이벤트'] || '-';
                return `
                    <tr>
                        <td><strong>#${a.index + 1}</strong></td>
                        <td>${timeVal}</td>
                        <td style="color: #ef4444; font-weight: 700;">${a.value.toFixed(3)}</td>
                        <td>${a.zScore.toFixed(3)}</td>
                        <td><span class="badge-tag badge-danger">${a.type}</span> (${eventVal})</td>
                    </tr>
                `;
            }).join('');
        }

        const timeCol = currentData.columns[0];
        const labels = timeCol.rawValues.map((v, i) => v ? String(v) : `#${i + 1}`);

        chartManager.renderControlChart('controlChart', labels, col.numericValues, { cl: res.cl, ucl: res.ucl, lcl: res.lcl }, res.anomalies, isDarkMode);
    }

    // 토스트 알림 함수
    function showNotification(msg, type = 'info') {
        const existing = document.getElementById('appToast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'appToast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = type === 'success' ? '#10b981' : '#0284c7';
        toast.style.color = '#fff';
        toast.style.padding = '10px 18px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '0.85rem';
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
        toast.style.zIndex = '9999';
        toast.style.transition = 'all 0.3s ease';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${msg}`;

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 초기 실행: 내장 더미 데이터 자동 로드
    setTimeout(() => {
        loadDefaultDataset();
    }, 100);
});
