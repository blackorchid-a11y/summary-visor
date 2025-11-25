import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SubjectCard } from './components/SubjectCard';
import { TopicList } from './components/TopicList';
import { TopicViewer } from './components/TopicViewer';
import { CreateSubjectModal } from './components/CreateSubjectModal';
import { getSubjects, getTopicsBySubject, saveTopic, deleteTopic, initDB, saveSubject, getTopic } from './lib/db';
import { initialSubjects } from './lib/initialData';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';

function App() {
  const [view, setView] = useState('home'); // home, subject, topic
  const [activeSubject, setActiveSubject] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Initialize DB and load subjects
      const db = await initDB();
      // Check if we have subjects, if not, use initialData
      let loadedSubjects = await getSubjects();
      if (loadedSubjects.length === 0) {
        for (const sub of initialSubjects) {
          await saveSubject(sub);
        }
        loadedSubjects = initialSubjects;
      }
      setSubjects(loadedSubjects);

      // Restore state from localStorage
      try {
        const savedView = localStorage.getItem('app_view');
        const savedSubjectId = localStorage.getItem('app_activeSubjectId');
        const savedTopicId = localStorage.getItem('app_activeTopicId');

        if (savedSubjectId) {
          const subject = loadedSubjects.find(s => s.id === savedSubjectId);
          if (subject) {
            setActiveSubject(subject);
            const subjectTopics = await getTopicsBySubject(subject.id);
            setTopics(subjectTopics);

            if (savedTopicId) {
              const topic = await getTopic(savedTopicId);
              if (topic) {
                setActiveTopic(topic);
              }
            }

            if (savedView) {
              setView(savedView);
            }
          }
        }
      } catch (error) {
        console.error('Error restoring state:', error);
      }

      setLoading(false);
    };
    loadData();
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('app_view', view);
    if (view === 'home') {
      localStorage.removeItem('app_activeSubjectId');
      localStorage.removeItem('app_activeTopicId');
    } else if (view === 'subject') {
      if (activeSubject) localStorage.setItem('app_activeSubjectId', activeSubject.id);
      localStorage.removeItem('app_activeTopicId');
    } else if (view === 'topic') {
      if (activeSubject) localStorage.setItem('app_activeSubjectId', activeSubject.id);
      if (activeTopic) localStorage.setItem('app_activeTopicId', activeTopic.id);
    }
  }, [view, activeSubject, activeTopic]);

  const handleSubjectClick = async (subject) => {
    setActiveSubject(subject);
    const subjectTopics = await getTopicsBySubject(subject.id);
    setTopics(subjectTopics);
    setView('subject');
  };

  const handleTopicClick = (topic) => {
    setActiveTopic(topic);
    setView('topic');
  };

  const handleBack = () => {
    if (view === 'topic') {
      setView('subject');
      setActiveTopic(null);
    } else if (view === 'subject') {
      setView('home');
      setActiveSubject(null);
    }
  };

  const handleAddTopic = async () => {
    // Simple file input trigger
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const title = file.name.replace('.html', '');

      const newTopic = {
        id: crypto.randomUUID(),
        subjectId: activeSubject.id,
        title: title,
        content: text,
        lastModified: Date.now(),
      };

      await saveTopic(newTopic);
      const updatedTopics = await getTopicsBySubject(activeSubject.id);
      setTopics(updatedTopics);
    };
    input.click();
  };

  const handleDeleteTopic = async (topicId) => {
    if (confirm('¿Estás seguro de que quieres eliminar este tema?')) {
      await deleteTopic(topicId);
      const updatedTopics = await getTopicsBySubject(activeSubject.id);
      setTopics(updatedTopics);
    }
  };

  const handleCreateSubject = async (data) => {
    const newSubject = {
      id: crypto.randomUUID(),
      ...data
    };
    await saveSubject(newSubject);
    setSubjects([...subjects, newSubject]);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <Layout className="pt-[env(safe-area-inset-top)]">
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                <h1 className="text-3xl font-bold text-gray-900">Mis Resúmenes MIR</h1>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus size={20} />
                Nueva Asignatura
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  onClick={() => handleSubjectClick(subject)}
                />
              ))}
            </div>

            <CreateSubjectModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onCreate={handleCreateSubject}
            />
          </motion.div>
        )}

        {view === 'subject' && activeSubject && (
          <motion.div
            key="subject"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              &larr; Volver a asignaturas
            </button>
            <TopicList
              subject={activeSubject}
              topics={topics}
              onSelectTopic={handleTopicClick}
              onAddTopic={handleAddTopic}
              onDeleteTopic={handleDeleteTopic}
              onAddDemoTopic={async (demoTopic) => {
                await saveTopic(demoTopic);
                const updatedTopics = await getTopicsBySubject(activeSubject.id);
                setTopics(updatedTopics);
              }}
            />
          </motion.div>
        )}

        {view === 'topic' && activeTopic && (
          <motion.div
            key="topic"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
          >
            <TopicViewer topic={activeTopic} onBack={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

export default App;
