/**
 * StatsEngine - 클라이언트 사이드 고정밀 통계 연산 엔진
 * 순수 JavaScript로 구현되어 브라우저 메모리 상에서만 즉각 계산됩니다.
 */
class StatsEngine {
    /**
     * 수치 배열의 기본 기술통계량 산출
     */
    static describe(values) {
        const nums = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
        const n = nums.length;
        if (n === 0) return null;

        const sum = nums.reduce((acc, val) => acc + val, 0);
        const mean = sum / n;
        const min = nums[0];
        const max = nums[n - 1];
        const range = max - min;

        // 사분위수 및 중앙값 (Interpolated)
        const getPercentile = (p) => {
            const pos = (n - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (nums[base + 1] !== undefined) {
                return nums[base] + rest * (nums[base + 1] - nums[base]);
            } else {
                return nums[base];
            }
        };

        const median = getPercentile(0.5);
        const q1 = getPercentile(0.25);
        const q3 = getPercentile(0.75);
        const iqr = q3 - q1;

        // 분산 & 표준편차 (표본분산 n-1 적용)
        let sumSquaredDiff = 0;
        let sumCubedDiff = 0;
        let sumFourthDiff = 0;

        for (let i = 0; i < n; i++) {
            const diff = nums[i] - mean;
            const diffSq = diff * diff;
            sumSquaredDiff += diffSq;
            sumCubedDiff += diffSq * diff;
            sumFourthDiff += diffSq * diffSq;
        }

        const variance = n > 1 ? sumSquaredDiff / (n - 1) : 0;
        const stdDev = Math.sqrt(variance);

        // 왜도 (Skewness) & 첨도 (Kurtosis)
        let skewness = 0;
        let kurtosis = 0;
        if (n > 2 && stdDev > 0) {
            skewness = (sumCubedDiff / n) / Math.pow(variance * (n - 1) / n, 1.5);
        }
        if (n > 3 && stdDev > 0) {
            kurtosis = (sumFourthDiff / n) / Math.pow(variance * (n - 1) / n, 2) - 3;
        }

        // 최빈값 계산 (소수점 2자리 반올림 기준 빈도)
        const freqMap = {};
        let maxFreq = 0;
        let mode = mean;
        for (let num of nums) {
            const key = num.toFixed(2);
            freqMap[key] = (freqMap[key] || 0) + 1;
            if (freqMap[key] > maxFreq) {
                maxFreq = freqMap[key];
                mode = parseFloat(key);
            }
        }

        return {
            count: n,
            mean,
            median,
            mode,
            stdDev,
            variance,
            min,
            max,
            range,
            q1,
            q3,
            iqr,
            skewness,
            kurtosis
        };
    }

    /**
     * 피어슨 상관계수 (Pearson Correlation) 및 p-value 근사치 계산
     */
    static pearsonCorrelation(x, y) {
        const pairs = [];
        for (let i = 0; i < Math.min(x.length, y.length); i++) {
            if (typeof x[i] === 'number' && !isNaN(x[i]) && typeof y[i] === 'number' && !isNaN(y[i])) {
                pairs.push([x[i], y[i]]);
            }
        }
        const n = pairs.length;
        if (n < 2) return { r: 0, pValue: 1, n };

        const meanX = pairs.reduce((acc, p) => acc + p[0], 0) / n;
        const meanY = pairs.reduce((acc, p) => acc + p[1], 0) / n;

        let num = 0;
        let denX = 0;
        let denY = 0;

        for (let [xi, yi] of pairs) {
            const dx = xi - meanX;
            const dy = yi - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        }

        const denominator = Math.sqrt(denX * denY);
        const r = denominator === 0 ? 0 : num / denominator;

        // t-value & p-value
        let pValue = 1;
        if (Math.abs(r) < 1 && n > 2) {
            const t = r * Math.sqrt((n - 2) / (1 - r * r));
            pValue = this.tDistPValue(Math.abs(t), n - 2);
        } else if (Math.abs(r) >= 1) {
            pValue = 0;
        }

        return { r, pValue, n };
    }

    /**
     * 단순 선형 회귀분석 (Simple Linear Regression)
     */
    static linearRegression(x, y) {
        const pairs = [];
        for (let i = 0; i < Math.min(x.length, y.length); i++) {
            if (typeof x[i] === 'number' && !isNaN(x[i]) && typeof y[i] === 'number' && !isNaN(y[i])) {
                pairs.push([x[i], y[i]]);
            }
        }
        const n = pairs.length;
        if (n < 2) return null;

        const meanX = pairs.reduce((acc, p) => acc + p[0], 0) / n;
        const meanY = pairs.reduce((acc, p) => acc + p[1], 0) / n;

        let ssXX = 0;
        let ssXY = 0;
        let ssYY = 0;

        for (let [xi, yi] of pairs) {
            const dx = xi - meanX;
            const dy = yi - meanY;
            ssXX += dx * dx;
            ssXY += dx * dy;
            ssYY += dy * dy;
        }

        if (ssXX === 0) return null;

        const slope = ssXY / ssXX;
        const intercept = meanY - slope * meanX;
        const rSquared = ssYY === 0 ? 0 : (ssXY * ssXY) / (ssXX * ssYY);

        // 잔차 표준오차 (Standard Error of Estimate)
        let sse = 0;
        const residuals = [];
        for (let [xi, yi] of pairs) {
            const pred = slope * xi + intercept;
            const res = yi - pred;
            residuals.push(res);
            sse += res * res;
        }
        const seRegression = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
        const seSlope = ssXX > 0 ? seRegression / Math.sqrt(ssXX) : 0;
        const tStat = seSlope > 0 ? slope / seSlope : 0;
        const pValue = n > 2 ? this.tDistPValue(Math.abs(tStat), n - 2) : 1;

        return {
            slope,
            intercept,
            rSquared,
            r: (slope >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, rSquared)),
            pValue,
            tStat,
            seRegression,
            residuals,
            n
        };
    }

    /**
     * 센서 오차 평가 지표 (원시값 vs 참값 비교)
     */
    static evaluateSensorError(raw, trueVal) {
        const pairs = [];
        for (let i = 0; i < Math.min(raw.length, trueVal.length); i++) {
            if (typeof raw[i] === 'number' && !isNaN(raw[i]) && typeof trueVal[i] === 'number' && !isNaN(trueVal[i])) {
                pairs.push([raw[i], trueVal[i]]);
            }
        }
        const n = pairs.length;
        if (n === 0) return null;

        let sumAbsErr = 0;
        let sumSqErr = 0;
        let sumErr = 0;
        let maxErr = 0;
        const errors = [];

        for (let [r, t] of pairs) {
            const err = r - t;
            errors.push(err);
            const absErr = Math.abs(err);
            sumAbsErr += absErr;
            sumSqErr += err * err;
            sumErr += err;
            if (absErr > maxErr) maxErr = absErr;
        }

        const mae = sumAbsErr / n;
        const rmse = Math.sqrt(sumSqErr / n);
        const bias = sumErr / n; // 평균 오차(편향)

        // 대응표본 t-검정 (Paired t-test)
        const pairedT = this.pairedTTest(pairs.map(p => p[0]), pairs.map(p => p[1]));

        return {
            n,
            mae,
            rmse,
            bias,
            maxErr,
            errors,
            pairedT
        };
    }

    /**
     * 독립 2표본 t-검정 (Independent Two-Sample Welch's t-test)
     */
    static independentTTest(sampleA, sampleB) {
        const a = sampleA.filter(v => typeof v === 'number' && !isNaN(v));
        const b = sampleB.filter(v => typeof v === 'number' && !isNaN(v));
        const nA = a.length;
        const nB = b.length;
        if (nA < 2 || nB < 2) return null;

        const meanA = a.reduce((s, v) => s + v, 0) / nA;
        const meanB = b.reduce((s, v) => s + v, 0) / nB;

        const varA = a.reduce((s, v) => s + Math.pow(v - meanA, 2), 0) / (nA - 1);
        const varB = b.reduce((s, v) => s + Math.pow(v - meanB, 2), 0) / (nB - 1);

        const seDiff = Math.sqrt((varA / nA) + (varB / nB));
        if (seDiff === 0) return { tStat: 0, df: nA + nB - 2, pValue: 1, meanA, meanB };

        const tStat = (meanA - meanB) / seDiff;

        // Welch–Satterthwaite 자유도 (df)
        const numDf = Math.pow((varA / nA) + (varB / nB), 2);
        const denDf = (Math.pow(varA / nA, 2) / (nA - 1)) + (Math.pow(varB / nB, 2) / (nB - 1));
        const df = denDf === 0 ? nA + nB - 2 : numDf / denDf;

        const pValue = this.tDistPValue(Math.abs(tStat), df);

        return {
            tStat,
            df,
            pValue,
            meanA,
            meanB,
            diff: meanA - meanB,
            isSignificant: pValue < 0.05
        };
    }

    /**
     * 대응표본 t-검정 (Paired Samples t-test)
     */
    static pairedTTest(sampleA, sampleB) {
        const diffs = [];
        for (let i = 0; i < Math.min(sampleA.length, sampleB.length); i++) {
            if (typeof sampleA[i] === 'number' && !isNaN(sampleA[i]) && typeof sampleB[i] === 'number' && !isNaN(sampleB[i])) {
                diffs.push(sampleA[i] - sampleB[i]);
            }
        }
        const n = diffs.length;
        if (n < 2) return null;

        const meanDiff = diffs.reduce((s, d) => s + d, 0) / n;
        const varDiff = diffs.reduce((s, d) => s + Math.pow(d - meanDiff, 2), 0) / (n - 1);
        const stdErrDiff = Math.sqrt(varDiff / n);

        const tStat = stdErrDiff === 0 ? 0 : meanDiff / stdErrDiff;
        const df = n - 1;
        const pValue = this.tDistPValue(Math.abs(tStat), df);

        return {
            tStat,
            df,
            pValue,
            meanDiff,
            isSignificant: pValue < 0.05
        };
    }

    /**
     * 일원배치 분산분석 (One-Way ANOVA)
     * groups: { "정상": [values], "경고": [values], ... }
     */
    static oneWayANOVA(groups) {
        const groupKeys = Object.keys(groups).filter(k => groups[k] && groups[k].length > 1);
        const k = groupKeys.length;
        if (k < 2) return null;

        let totalN = 0;
        let totalSum = 0;
        const groupStats = {};

        for (let key of groupKeys) {
            const vals = groups[key].filter(v => typeof v === 'number' && !isNaN(v));
            const n = vals.length;
            if (n === 0) continue;
            const sum = vals.reduce((a, b) => a + b, 0);
            const mean = sum / n;
            groupStats[key] = { n, sum, mean, vals };
            totalN += n;
            totalSum += sum;
        }

        const grandMean = totalSum / totalN;

        // SS Between (집단 간 제곱합) & SS Within (집단 내 제곱합)
        let ssBetween = 0;
        let ssWithin = 0;

        for (let key of groupKeys) {
            const g = groupStats[key];
            if (!g) continue;
            ssBetween += g.n * Math.pow(g.mean - grandMean, 2);
            for (let v of g.vals) {
                ssWithin += Math.pow(v - g.mean, 2);
            }
        }

        const dfBetween = k - 1;
        const dfWithin = totalN - k;

        if (dfWithin <= 0) return null;

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;

        const fStat = msWithin === 0 ? 0 : msBetween / msWithin;
        const pValue = this.fDistPValue(fStat, dfBetween, dfWithin);

        return {
            fStat,
            pValue,
            dfBetween,
            dfWithin,
            ssBetween,
            ssWithin,
            groupStats,
            isSignificant: pValue < 0.05
        };
    }

    /**
     * 이상치 감지 (IQR & Z-Score & Shewhart 관리도)
     */
    static detectAnomalies(values, options = { zThreshold: 2.5, iqrMultiplier: 1.5 }) {
        const validIndices = [];
        const nums = [];
        values.forEach((v, idx) => {
            if (typeof v === 'number' && !isNaN(v)) {
                validIndices.push(idx);
                nums.push(v);
            }
        });

        const n = nums.length;
        if (n === 0) return null;

        const stats = this.describe(nums);
        const { mean, stdDev, q1, q3, iqr } = stats;

        // IQR 기준 이상치 한계선
        const iqrLower = q1 - options.iqrMultiplier * iqr;
        const iqrUpper = q3 + options.iqrMultiplier * iqr;

        // Z-Score 및 3-시그마 관리도 한계선 (UCL, CL, LCL)
        const cl = mean;
        const ucl = mean + 3 * stdDev;
        const lcl = mean - 3 * stdDev;

        const anomalyPoints = [];

        nums.forEach((val, i) => {
            const originalIndex = validIndices[i];
            const zScore = stdDev === 0 ? 0 : (val - mean) / stdDev;
            const isZOutlier = Math.abs(zScore) >= options.zThreshold;
            const isIqrOutlier = val < iqrLower || val > iqrUpper;
            const isControlChartOutlier = val < lcl || val > ucl;

            if (isZOutlier || isIqrOutlier || isControlChartOutlier) {
                anomalyPoints.push({
                    index: originalIndex,
                    value: val,
                    zScore,
                    isZOutlier,
                    isIqrOutlier,
                    isControlChartOutlier,
                    type: isZOutlier && isIqrOutlier ? '심각한 이상치' : '경고성 이상치'
                });
            }
        });

        return {
            stats,
            iqrLower,
            iqrUpper,
            cl,
            ucl,
            lcl,
            anomalies: anomalyPoints,
            totalCount: n,
            anomalyRate: (anomalyPoints.length / n) * 100
        };
    }

    /**
     * t-분포 p-value 양측검정 근사 계산기
     */
    static tDistPValue(t, df) {
        if (df <= 0) return 1;
        const x = df / (df + t * t);
        // Regularized incomplete beta function I_x(df/2, 1/2)
        return this.ibeta(df / 2, 0.5, x);
    }

    /**
     * F-분포 p-value 근사 계산기
     */
    static fDistPValue(f, df1, df2) {
        if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
        const x = df2 / (df2 + df1 * f);
        return this.ibeta(df2 / 2, df1 / 2, x);
    }

    /**
     * 불완전 베타 함수 (Incomplete Beta Function - Continued Fraction approximation)
     */
    static ibeta(a, b, x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;

        // Log Gamma approximation (Lanczos)
        const lgamma = (z) => {
            const g = 7;
            const p = [
                0.99999999999980993, 676.5203681218851, -1259.1392167224028,
                771.32342877765313, -176.61502916214059, 12.507343278686905,
                -0.13857109583659912, 9.9843695780195716e-6, 1.5056327351493116e-7
            ];
            if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
            z -= 1;
            let base = p[0];
            for (let i = 1; i < g + 2; i++) base += p[i] / (z + i);
            const t = z + g + 0.5;
            return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(base);
        };

        const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));

        // Continued fraction evaluation
        if (x < (a + 1) / (a + b + 2)) {
            return (bt * this.betacf(a, b, x)) / a;
        } else {
            return 1 - (bt * this.betacf(b, a, 1 - x)) / b;
        }
    }

    static betacf(a, b, x) {
        const MAXIT = 100;
        const EPS = 3e-7;
        const FPMIN = 1e-30;

        const qab = a + b;
        const qap = a + 1;
        const qam = a - 1;
        let c = 1;
        let d = 1 - (qab * x) / qap;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        d = 1 / d;
        let h = d;

        for (let m = 1; m <= MAXIT; m++) {
            const m2 = 2 * m;
            let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < FPMIN) d = FPMIN;
            c = 1 + aa / c;
            if (Math.abs(c) < FPMIN) c = FPMIN;
            d = 1 / d;
            h *= d * c;

            aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
            d = 1 + aa * d;
            if (Math.abs(d) < FPMIN) d = FPMIN;
            c = 1 + aa / c;
            if (Math.abs(c) < FPMIN) c = FPMIN;
            d = 1 / d;
            const del = d * c;
            h *= del;
            if (Math.abs(del - 1) < EPS) break;
        }
        return h;
    }
}

window.StatsEngine = StatsEngine;
