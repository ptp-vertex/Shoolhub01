
        /* SchoolHub central score helper: fixes JavaScript floating point display without changing saved Firebase data */
        function normalizeScoreNumber(value, digits = 2) {
            const n = Number(value);
            if (!Number.isFinite(n)) return 0;
            const factor = Math.pow(10, digits);
            const fixed = Math.round((n + Number.EPSILON) * factor) / factor;
            return Number(fixed.toFixed(digits));
        }

        function formatScoreDisplay(value, digits = 2) {
            const n = normalizeScoreNumber(value, digits);
            if (Number.isInteger(n)) return String(n);
            return String(n).replace(/\.?0+$/, '');
        }

        function isMissingScoreValue(value) {
            if (value === undefined || value === null || value === '') return true;
            return String(value).trim().toUpperCase() === 'X';
        }

        function scoreNumberOrNull(value) {
            if (isMissingScoreValue(value)) return null;
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        }

        function addScoreToTotal(total, value, digits = 2) {
            const n = scoreNumberOrNull(value);
            if (n === null) return normalizeScoreNumber(total || 0, digits);
            return normalizeScoreNumber(Number(total || 0) + n, digits);
        }

        function formatScoreValueHtml(value, digits = 2) {
            if (isMissingScoreValue(value)) return '<span class="summary-score-cell-content text-rose-600 font-black">X</span>';
            return formatScoreDisplay(value, digits);
        }

        function safeText(value, fallback = '') {
            if (value === null || value === undefined) return fallback;
            return String(value);
        }

        function isWithdrawnStudent(student) {
            return !!(
                student && (
                    student.withdrawn === true ||
                    student.isWithdrawn === true ||
                    student.status === 'withdrawn' ||
                    student.status === 'ลาออก'
                )
            );
        }

        function renderWithdrawnScoreCell() {
            return '<span class="withdrawn-score-cell">ลาออก</span>';
        }

        function renderWithdrawnGradeCell() {
            return '<span class="withdrawn-grade withdrawn-grade-cell">ลาออก</span>';
        }

        window.normalizeScoreNumber = normalizeScoreNumber;
        window.formatScoreDisplay = formatScoreDisplay;
        window.isMissingScoreValue = isMissingScoreValue;
        window.scoreNumberOrNull = scoreNumberOrNull;
        window.addScoreToTotal = addScoreToTotal;
        window.formatScoreValueHtml = formatScoreValueHtml;
        window.safeText = safeText;
        window.isWithdrawnStudent = isWithdrawnStudent;
        window.renderWithdrawnScoreCell = renderWithdrawnScoreCell;
        window.renderWithdrawnGradeCell = renderWithdrawnGradeCell;
    