/**
 * ChartManager - Chart.js 차트 인스턴스 생명주기 및 테마 관리
 */
class ChartManager {
    constructor() {
        this.charts = {};
    }

    /**
     * 특정 캔버스의 기존 차트 파괴 후 안전한 생성
     */
    destroyChart(id) {
        if (this.charts[id]) {
            this.charts[id].destroy();
            delete this.charts[id];
        }
    }

    destroyAll() {
        Object.keys(this.charts).forEach(id => this.destroyChart(id));
    }

    /**
     * 공통 차트 테마 옵션
     */
    getDefaultOptions(title = '', isDark = true) {
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!title,
                    text: title,
                    color: textColor,
                    font: { size: 14, weight: '600', family: 'Inter, Pretendard, sans-serif' }
                },
                legend: {
                    labels: {
                        color: textColor,
                        font: { family: 'Inter, Pretendard, sans-serif' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#38bdf8',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        };
    }

    /**
     * 1. 시계열 멀티 트렌드 차트
     */
    renderTimeSeries(canvasId, timeLabels, datasets, isDark = true) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const options = this.getDefaultOptions('센서 시계열 트렌드 모니터링', isDark);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: datasets.map((ds, idx) => {
                    const colors = ['#38bdf8', '#818cf8', '#34d399', '#f43f5e', '#fbbf24'];
                    const color = colors[idx % colors.length];
                    return {
                        label: ds.label,
                        data: ds.data,
                        borderColor: color,
                        backgroundColor: color + '20',
                        borderWidth: 2,
                        pointRadius: ds.data.length > 100 ? 1 : 3,
                        pointHoverRadius: 6,
                        tension: 0.2,
                        yAxisID: ds.yAxisID || 'y'
                    };
                })
            },
            options
        });
    }

    /**
     * 2. 산점도 및 선형 회귀 차트
     */
    renderScatterRegression(canvasId, points, regressionLine, xLabel, yLabel, isDark = true) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const options = this.getDefaultOptions(`${xLabel} vs ${yLabel} 회귀 분석`, isDark);

        options.scales.x.title = { display: true, text: xLabel, color: isDark ? '#cbd5e1' : '#475569' };
        options.scales.y.title = { display: true, text: yLabel, color: isDark ? '#cbd5e1' : '#475569' };

        const datasets = [
            {
                type: 'scatter',
                label: '데이터 샘플',
                data: points,
                backgroundColor: 'rgba(56, 189, 248, 0.7)',
                borderColor: '#0284c7',
                pointRadius: 4,
                pointHoverRadius: 7
            }
        ];

        if (regressionLine && regressionLine.length >= 2) {
            datasets.push({
                type: 'line',
                label: `회귀선: y = ${regressionLine[0].slope >= 0 ? '+' : ''}${regressionLine[0].slope.toFixed(4)}x ${regressionLine[0].intercept >= 0 ? '+' : '-'} ${Math.abs(regressionLine[0].intercept).toFixed(4)}`,
                data: regressionLine.map(p => ({ x: p.x, y: p.y })),
                borderColor: '#f43f5e',
                borderWidth: 2.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            });
        }

        this.charts[canvasId] = new Chart(ctx, {
            data: { datasets },
            options
        });
    }

    /**
     * 3. 3-시그마 관리도 및 이상치 시각화
     */
    renderControlChart(canvasId, labels, values, controlLimits, anomalies, isDark = true) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const { cl, ucl, lcl } = controlLimits;
        const options = this.getDefaultOptions('Shewhart 3-Sigma 관리도 및 이상치 모니터링', isDark);

        const pointBackgroundColors = values.map((_, i) => {
            const isOutlier = anomalies.some(a => a.index === i);
            return isOutlier ? '#ef4444' : '#38bdf8';
        });

        const pointRadii = values.map((_, i) => {
            const isOutlier = anomalies.some(a => a.index === i);
            return isOutlier ? 6 : 2.5;
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '측정값',
                        data: values,
                        borderColor: '#38bdf8',
                        borderWidth: 1.8,
                        pointBackgroundColor: pointBackgroundColors,
                        pointBorderColor: '#0f172a',
                        pointRadius: pointRadii,
                        tension: 0.1
                    },
                    {
                        label: `상한선 (UCL: ${ucl.toFixed(2)})`,
                        data: Array(values.length).fill(ucl),
                        borderColor: '#f87171',
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: `중심선 (CL/Mean: ${cl.toFixed(2)})`,
                        data: Array(values.length).fill(cl),
                        borderColor: '#34d399',
                        borderWidth: 1.5,
                        borderDash: [2, 2],
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: `하한선 (LCL: ${lcl.toFixed(2)})`,
                        data: Array(values.length).fill(lcl),
                        borderColor: '#f87171',
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options
        });
    }

    /**
     * 4. 기술통계 히스토그램 및 밀도분포
     */
    renderHistogram(canvasId, values, varName, binCount = 12, isDark = true) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (nums.length === 0) return;

        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const binWidth = (max - min) / binCount || 1;

        const bins = Array(binCount).fill(0);
        const binLabels = [];

        for (let i = 0; i < binCount; i++) {
            const bStart = min + i * binWidth;
            const bEnd = bStart + binWidth;
            binLabels.push(`${bStart.toFixed(1)}~${bEnd.toFixed(1)}`);
        }

        nums.forEach(val => {
            let idx = Math.floor((val - min) / binWidth);
            if (idx >= binCount) idx = binCount - 1;
            if (idx < 0) idx = 0;
            bins[idx]++;
        });

        const options = this.getDefaultOptions(`${varName} 빈도 히스토그램 분포`, isDark);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [
                    {
                        label: '데이터 빈도 수 (건)',
                        data: bins,
                        backgroundColor: 'rgba(56, 189, 248, 0.65)',
                        borderColor: '#0284c7',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options
        });
    }

    /**
     * 5. 센서 오차 및 잔차 분석 차트
     */
    renderResiduals(canvasId, labels, errors, isDark = true) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const options = this.getDefaultOptions('센서 오차(잔차: 원시값 - 참값) 분포', isDark);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: '센서 잔차 (°C)',
                        data: errors,
                        backgroundColor: errors.map(e => e >= 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(244, 63, 94, 0.7)'),
                        borderColor: errors.map(e => e >= 0 ? '#0284c7' : '#e11d48'),
                        borderWidth: 1,
                        borderRadius: 3
                    },
                    {
                        type: 'line',
                        label: '기준 오차선 (0°C)',
                        data: Array(errors.length).fill(0),
                        borderColor: '#94a3b8',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0
                    }
                ]
            },
            options
        });
    }
}

window.ChartManager = ChartManager;
