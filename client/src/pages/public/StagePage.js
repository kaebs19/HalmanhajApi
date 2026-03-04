import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE, SERVER_URL } from '../../lib/api';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import SEO from '../../components/public/SEO';

export default function StagePage() {
  const { stage } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/public/stages/${stage}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-gray-600 mb-2">الصفحة غير موجودة</h2>
        <Link to="/" className="text-blue-600 hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const stageSlug = data.stage.public_slug || data.stage.slug;
  const hasGrades = data.grades?.length > 0;
  const hasTracks = data.tracks?.length > 0;
  // الصفوف تأخذ الأولوية (الثانوية لها صفوف الآن مع مسارات داخلية عبر grade_tracks)
  const showTracks = hasTracks && !hasGrades;

  const filteredGrades = selectedTrack
    ? data.grades.filter(g => g.track_id === selectedTrack)
    : data.grades;

  const itemCount = showTracks ? data.tracks.length : data.grades.length;
  const itemLabel = showTracks ? 'مسار دراسي' : 'صف دراسي';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={data.stage.name} description={`حلول ومناهج ${data.stage.name} - جميع الصفوف والمواد`} />
      <Breadcrumbs items={[{ label: data.stage.name }]} />

      {/* Header */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          {data.stage.icon && <span className="text-4xl">{data.stage.icon}</span>}
          <div>
            <h1 className="text-2xl font-bold">{data.stage.name}</h1>
            <p className="text-blue-200 text-sm mt-1">{itemCount} {itemLabel}</p>
          </div>
        </div>
      </div>

      {showTracks ? (
        /* عرض المسارات كبطاقات (مثل الثانوية) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.tracks.map(track => (
            <Link
              key={track.id}
              to={`/${stageSlug}/${track.slug}`}
              className="group bg-white rounded-xl border border-gray-100 p-5 text-center hover:shadow-lg hover:border-emerald-100 transition-all duration-300"
            >
              {track.image_url ? (
                <img src={`${SERVER_URL}${track.image_url}`} alt={track.name} className="w-14 h-14 mx-auto mb-3 rounded-xl object-cover" />
              ) : (
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-teal-200 transition-colors">
                  <span className="text-2xl">{track.icon || '🛤️'}</span>
                </div>
              )}
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{track.name}</h3>
            </Link>
          ))}
        </div>
      ) : (
        /* عرض الصفوف كبطاقات */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredGrades.map(grade => {
            const gradeSlug = grade.public_slug || grade.slug;
            return (
              <Link
                key={grade.id}
                to={`/${stageSlug}/${gradeSlug}`}
                className="group bg-white rounded-xl border border-gray-100 p-5 text-center hover:shadow-lg hover:border-blue-100 transition-all duration-300"
              >
                {grade.image_url ? (
                  <img src={`${SERVER_URL}${grade.image_url}`} alt={grade.name} className="w-14 h-14 mx-auto mb-3 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                )}
                <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{grade.name}</h3>
                {grade.tracks?.length > 0 ? (
                  <p className="text-xs text-gray-400 mt-1">{grade.tracks.length} {grade.tracks.length === 1 ? 'مسار' : 'مسارات'}</p>
                ) : grade.track_name ? (
                  <p className="text-xs text-gray-400 mt-1">{grade.track_name}</p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
