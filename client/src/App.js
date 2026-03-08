import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { SemesterProvider } from './context/SemesterContext';
import { UserAuthProvider } from './context/UserAuthContext';
import { AdsProvider } from './context/AdsContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingState from './components/ui/LoadingState';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/public/HomePage';
import StagePage from './pages/public/StagePage';
import GradePage from './pages/public/GradePage';
import SubjectPage from './pages/public/SubjectPage';
import FilePage from './pages/public/FilePage';
import SearchPage from './pages/public/SearchPage';
import NotFoundPage from './pages/public/NotFoundPage';

// صفحات لوحة التحكم - Lazy (ثقيلة/نادرة الاستخدام)
const SemestersPage = React.lazy(() => import('./pages/SemestersPage'));
const StagesPage = React.lazy(() => import('./pages/StagesPage'));
const GradesPage = React.lazy(() => import('./pages/GradesPage'));
const TracksPage = React.lazy(() => import('./pages/TracksPage'));
const SubjectsPage = React.lazy(() => import('./pages/SubjectsPage'));
const LessonsSubjectsPage = React.lazy(() => import('./pages/LessonsSubjectsPage'));
const LessonsGradePickerPage = React.lazy(() => import('./pages/LessonsGradePickerPage'));
const LessonsListPage = React.lazy(() => import('./pages/LessonsListPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const PdfToolsPage = React.lazy(() => import('./pages/PdfToolsPage'));
const QuizzesManagePage = React.lazy(() => import('./pages/QuizzesManagePage'));
const FaqManagePage = React.lazy(() => import('./pages/FaqManagePage'));
const CommunityManagePage = React.lazy(() => import('./pages/CommunityManagePage'));
const UsersManagePage = React.lazy(() => import('./pages/UsersManagePage'));
const AdsManagePage = React.lazy(() => import('./pages/AdsManagePage'));
const ExerciseEditorPage = React.lazy(() => import('./pages/ExerciseEditorPage'));
const ExercisesListPage = React.lazy(() => import('./pages/ExercisesListPage'));
const StudentAnalyticsPage = React.lazy(() => import('./pages/StudentAnalyticsPage'));
const LearningPathManagerPage = React.lazy(() => import('./pages/LearningPathManagerPage'));
const QuestionReportsPage = React.lazy(() => import('./pages/QuestionReportsPage'));

// الموقع العام - Lazy (صفحات ثانوية)
const QuizzesPage = React.lazy(() => import('./pages/public/QuizzesPage'));
const QuizDetailPage = React.lazy(() => import('./pages/public/QuizDetailPage'));
const FaqPage = React.lazy(() => import('./pages/public/FaqPage'));
const QuestionDetailPage = React.lazy(() => import('./pages/public/QuestionDetailPage'));
const AskQuestionPage = React.lazy(() => import('./pages/public/AskQuestionPage'));
const UserProfilePage = React.lazy(() => import('./pages/public/UserProfilePage'));
const UserLoginPage = React.lazy(() => import('./pages/public/auth/UserLoginPage'));
const UserRegisterPage = React.lazy(() => import('./pages/public/auth/UserRegisterPage'));
const PageView = React.lazy(() => import('./pages/public/PageView'));
const StudentDashboardPage = React.lazy(() => import('./pages/public/StudentDashboardPage'));
const LeaderboardPage = React.lazy(() => import('./pages/public/LeaderboardPage'));
const ExercisesPage = React.lazy(() => import('./pages/public/ExercisesPage'));
const ExercisePlayPage = React.lazy(() => import('./pages/public/ExercisePlayPage'));
const NotificationsPage = React.lazy(() => import('./pages/public/NotificationsPage'));
const LearningPathPage = React.lazy(() => import('./pages/public/LearningPathPage'));
const ReviewPage = React.lazy(() => import('./pages/public/ReviewPage'));
const DailyChallengePage = React.lazy(() => import('./pages/public/DailyChallengePage'));

function App() {
  return (
    <HelmetProvider>
    <SettingsProvider>
      <AdsProvider>
      <AuthProvider>
        <UserAuthProvider>
          <SemesterProvider>
            <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingState /></div>}>
              <Routes>
                {/* ===== مسارات لوحة التحكم ===== */}
                <Route path="/admin/login" element={<LoginPage />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/semesters"
                  element={
                    <ProtectedRoute>
                      <SemestersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/stages"
                  element={
                    <ProtectedRoute>
                      <StagesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tracks"
                  element={
                    <ProtectedRoute>
                      <TracksPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/grades"
                  element={
                    <ProtectedRoute>
                      <GradesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/subjects"
                  element={
                    <ProtectedRoute>
                      <SubjectsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lessons"
                  element={
                    <ProtectedRoute>
                      <LessonsSubjectsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lessons/:subjectId"
                  element={
                    <ProtectedRoute>
                      <LessonsGradePickerPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lessons/:subjectId/shared"
                  element={
                    <ProtectedRoute>
                      <LessonsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lessons/:subjectId/grade/:gradeId"
                  element={
                    <ProtectedRoute>
                      <LessonsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/lessons/:subjectId/track/:trackId"
                  element={
                    <ProtectedRoute>
                      <LessonsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/exercises"
                  element={
                    <ProtectedRoute>
                      <ExercisesListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/exercises/create"
                  element={
                    <ProtectedRoute>
                      <ExerciseEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/exercises/:exerciseId/edit"
                  element={
                    <ProtectedRoute>
                      <ExerciseEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/pdf-tools"
                  element={
                    <ProtectedRoute>
                      <PdfToolsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quizzes"
                  element={
                    <ProtectedRoute>
                      <QuizzesManagePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/faqs"
                  element={
                    <ProtectedRoute>
                      <FaqManagePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/community"
                  element={
                    <ProtectedRoute>
                      <CommunityManagePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute>
                      <UsersManagePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/student-analytics"
                  element={
                    <ProtectedRoute>
                      <StudentAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/ads"
                  element={
                    <ProtectedRoute>
                      <AdsManagePage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/learning-paths"
                  element={
                    <ProtectedRoute>
                      <LearningPathManagerPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/question-reports"
                  element={
                    <ProtectedRoute>
                      <QuestionReportsPage />
                    </ProtectedRoute>
                  }
                />

                {/* توافقية: إعادة توجيه المسارات القديمة */}
                <Route path="/login" element={<Navigate to="/admin/login" replace />} />
                <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

                {/* ===== صفحات fullscreen (بدون header/footer) ===== */}
                <Route path="/exercises/:id/play" element={<ExercisePlayPage />} />
                <Route path="/learn/review" element={<ReviewPage />} />
                <Route path="/learn/daily-challenge" element={<DailyChallengePage />} />

                {/* ===== مسارات الموقع العام ===== */}
                <Route path="/" element={<PublicLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="quizzes" element={<QuizzesPage />} />
                  <Route path="quizzes/:slug" element={<QuizDetailPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="faq/question/:id" element={<QuestionDetailPage />} />
                  <Route path="faq/ask" element={<AskQuestionPage />} />
                  <Route path="profile/:id" element={<UserProfilePage />} />
                  <Route path="auth/login" element={<UserLoginPage />} />
                  <Route path="auth/register" element={<UserRegisterPage />} />
                  <Route path="privacy" element={<PageView />} />
                  <Route path="terms" element={<PageView />} />
                  <Route path="contact" element={<PageView />} />
                  <Route path="files/:slug" element={<FilePage />} />
                  <Route path="my-dashboard" element={<StudentDashboardPage />} />
                  <Route path="leaderboard" element={<LeaderboardPage />} />
                  <Route path="exercises" element={<ExercisesPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="learn/path/:subjectId" element={<LearningPathPage />} />
                  <Route path=":stage" element={<StagePage />} />
                  <Route path=":stage/:grade" element={<GradePage />} />
                  <Route path=":stage/:grade/:subject" element={<SubjectPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              </Suspense>
            </BrowserRouter>
            </ToastProvider>
          </SemesterProvider>
        </UserAuthProvider>
      </AuthProvider>
      </AdsProvider>
    </SettingsProvider>
    </HelmetProvider>
  );
}

export default App;
