"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGradeAwareAnswerMap = buildGradeAwareAnswerMap;
exports.createImportedInspectorResults = createImportedInspectorResults;
const anilScope17Scores = [
    8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 3, 3, 9, 9,
];
const anilScope18Scores = [8, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 7, 8];
function scoreAsAttempt(quiz, scoreOutOfTen) {
    const maxScore = quiz.questions.reduce((total, question) => total + question.points, 0);
    const score = Math.round((maxScore * scoreOutOfTen) / 10);
    const percentage = Math.round((score / maxScore) * 100);
    return { score, maxScore, percentage, passed: scoreOutOfTen >= 5 };
}
function authorizationGrade(scoreOutOfTen) {
    if (scoreOutOfTen > 8)
        return 'A';
    if (scoreOutOfTen >= 7)
        return 'B';
    if (scoreOutOfTen >= 5)
        return 'C';
    return 'W';
}
function buildIncorrectSelection(question) {
    const wrongOptions = question.options.filter((option) => !question.correct.includes(option.id));
    if (wrongOptions.length === 0) {
        return question.options.slice(0, Math.max(1, question.correct.length)).map((option) => option.id);
    }
    const wantedLength = Math.max(1, Math.min(question.correct.length || 1, wrongOptions.length));
    return wrongOptions.slice(0, wantedLength).map((option) => option.id);
}
function buildGradeAwareAnswerMap(quiz, scoreOutOfTen) {
    const maxScore = quiz.questions.reduce((total, question) => total + question.points, 0);
    const targetScore = Math.round((maxScore * scoreOutOfTen) / 10);
    const selectedByIndex = new Set();
    let bestMatch = { total: 0, indexes: new Set() };
    function explore(index, currentTotal, currentIndexes) {
        if (index === quiz.questions.length) {
            if (currentTotal > bestMatch.total || (currentTotal === bestMatch.total && currentIndexes.size > bestMatch.indexes.size)) {
                bestMatch = { total: currentTotal, indexes: new Set(currentIndexes) };
            }
            return;
        }
        const question = quiz.questions[index];
        explore(index + 1, currentTotal, currentIndexes);
        if (currentTotal + question.points <= targetScore) {
            const nextIndexes = new Set(currentIndexes);
            nextIndexes.add(index);
            explore(index + 1, currentTotal + question.points, nextIndexes);
        }
    }
    explore(0, 0, new Set());
    for (const index of bestMatch.indexes)
        selectedByIndex.add(index);
    return quiz.questions.reduce((answers, question, index) => {
        answers[question.id] = selectedByIndex.has(index)
            ? [...question.correct]
            : buildIncorrectSelection(question);
        return answers;
    }, {});
}
function createImportedInspectorResults(users, quizzes) {
    const anil = users.find((user) => user.name.trim().toLowerCase() === 'anil sanap');
    if (!anil)
        return [];
    const scores = [...anilScope17Scores, ...anilScope18Scores];
    return (anil.testAssignments ?? []).slice(0, scores.length).flatMap((assignment, index) => {
        const quiz = quizzes.find((item) => item.id === assignment.quizId);
        if (!quiz)
            return [];
        const result = scoreAsAttempt(quiz, scores[index]);
        const submittedAt = assignment.assessmentDate
            ? new Date(`${assignment.assessmentDate}T12:00:00`).getTime()
            : assignment.assignedAt;
        return [{
                id: `imported-${anil.id}-${assignment.quizId}`,
                quizId: quiz.id,
                quizTitle: quiz.title,
                userId: anil.id,
                userName: anil.name,
                attemptNumber: 1,
                answers: buildGradeAwareAnswerMap(quiz, scores[index]),
                ...result,
                competencyStatus: result.passed ? 'COMPETENT' : 'NOT COMPETENT',
                startedAt: submittedAt,
                timeSpent: 0,
                submittedAt,
                conductedBy: assignment.conductedBy,
                importedSource: 'competency-evaluation',
                recordedGrade: authorizationGrade(scores[index]),
            }];
    });
}
