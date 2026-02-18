import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { SemesterProvider } from './context/SemesterContext';
import { UserAuthProvider } from './context/UserAuthContext';
import { AdsProvider } from './context/AdsContext';
import ProtectedRoute from './components/ProtectedRoute';

// صفحات لوحة التحكم
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SemestersPage from './pages/SemestersPage';
import StagesPage from './pages/StagesPage';
import GradesPage from './pages/GradesPage';
import TracksPage from './pages/TracksPage';
import SubjectsPage from './pages/SubjectsPage';
import LessonsSubjectsPage from './pages/LessonsSubjectsPage';
import LessonsGradePickerPage from './pages/LessonsGradePickerPage';
import LessonsListPage from './pages/LessonsListPage';
import SettingsPage from './pages/SettingsPage';
import PdfToolsPage from './pages/PdfToolsPage';
import QuizzesManagePage from './pages/QuizzesManagePage';
import FaqManagePage from './pages/FaqManagePage';
import CommunityManagePage from './pages/CommunityManagePage';
import UsersManagePage from './pages/UsersManagePage';
import AdsManagePage from './pages/AdsManagePage';

// الموقع العام
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/public/HomePage';
import StagePage from './pages/public/StagePage';
import GradePage from './pages/public/GradePage';
import SubjectPage from './pages/public/SubjectPage';
import FilePage from './pages/public/FilePage';
import SearchPage from './pages/public/SearchPage';
import QuizzesPage from './pages/public/QuizzesPage';
import QuizDetailPage from './pages/public/QuizDetailPage';
import FaqPage from './pages/public/FaqPage';
import QuestionDetailPage from './pages/public/QuestionDetailPage';
import AskQuestionPage from './pages/public/AskQuestionPage';
import UserProfilePage from './pages/public/UserProfilePage';
import UserLoginPage from './pages/public/auth/UserLoginPage';
import UserRegisterPage from './pages/public/auth/UserRegisterPage';
import PageView from './pages/public/PageView';

function App() {
  return (
    <HelmetProvider>
    <SettingsProvider>
      <AdsProvider>
      <AuthProvider>
        <UserAuthProvider>
          <SemesterProvider>
            <BrowserRouter>
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
                  path="/admin/ads"
                  element={
                    <ProtectedRoute>
                      <AdsManagePage />
                    </ProtectedRoute>
                  }
                />

                {/* توافقية: إعادة توجيه المسارات القديمة */}
                <Route path="/login" element={<Navigate to="/admin/login" replace />} />
                <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

                {/* ===== مسارات الموقع العام ===== */}
                <Route path="/" element={<PublicLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="quizzes" element={<QuizzesPage />} />
                  <Route path="quizzes/:id" element={<QuizDetailPage />} />
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
                  <Route path=":stage" element={<StagePage />} />
                  <Route path=":stage/:grade" element={<GradePage />} />
                  <Route path=":stage/:grade/:subject" element={<SubjectPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SemesterProvider>
        </UserAuthProvider>
      </AuthProvider>
      </AdsProvider>
    </SettingsProvider>
    </HelmetProvider>
  );
}

export default App;
