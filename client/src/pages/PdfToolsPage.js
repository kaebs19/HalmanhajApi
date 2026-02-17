import { useState } from 'react';
import DashboardLayout from './DashboardLayout';
import { PageHeader, Card } from '../components/ui';
import CompressPdf from '../components/pdf-tools/CompressPdf';
import SplitPdf from '../components/pdf-tools/SplitPdf';
import MergePdf from '../components/pdf-tools/MergePdf';
import RemovePages from '../components/pdf-tools/RemovePages';
import ReorderPages from '../components/pdf-tools/ReorderPages';

const tools = [
  { id: 'compress', name: 'ضغط PDF', icon: '📦', desc: 'تقليل حجم ملف PDF مع الحفاظ على الجودة', color: 'from-blue-500 to-blue-600' },
  { id: 'split', name: 'تقسيم PDF', icon: '✂️', desc: 'تقسيم ملف PDF إلى جزأين عند صفحة محددة', color: 'from-emerald-500 to-emerald-600' },
  { id: 'merge', name: 'دمج PDF', icon: '🔗', desc: 'دمج عدة ملفات PDF في ملف واحد', color: 'from-purple-500 to-purple-600' },
  { id: 'remove', name: 'حذف صفحات', icon: '🗑️', desc: 'حذف صفحات محددة من ملف PDF', color: 'from-red-500 to-red-600' },
  { id: 'reorder', name: 'ترتيب صفحات', icon: '🔄', desc: 'إعادة ترتيب صفحات ملف PDF', color: 'from-amber-500 to-amber-600' },
];

const toolComponents = {
  compress: CompressPdf,
  split: SplitPdf,
  merge: MergePdf,
  remove: RemovePages,
  reorder: ReorderPages,
};

export default function PdfToolsPage() {
  const [activeTool, setActiveTool] = useState(null);

  const ActiveComponent = activeTool ? toolComponents[activeTool] : null;
  const activeToolInfo = tools.find(t => t.id === activeTool);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <PageHeader
          title="أدوات PDF"
          action={activeTool && (
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              ← العودة للأدوات
            </button>
          )}
        />

        {!activeTool ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <Card
                key={tool.id}
                className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all"
                onClick={() => setActiveTool(tool.id)}
              >
                <div className={`h-24 bg-gradient-to-l ${tool.color} flex items-center justify-center`}>
                  <span className="text-5xl group-hover:scale-110 transition-transform">{tool.icon}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{tool.name}</h3>
                  <p className="text-gray-500 text-sm">{tool.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-2xl">{activeToolInfo.icon}</span>
              <div>
                <h2 className="font-bold text-gray-800">{activeToolInfo.name}</h2>
                <p className="text-gray-500 text-sm">{activeToolInfo.desc}</p>
              </div>
            </div>
            <ActiveComponent />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
