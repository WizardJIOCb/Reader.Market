import { motion } from 'framer-motion';
import { FileText, Check, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const supportedFormats = [
  { name: 'PDF', icon: 'PDF', available: true },
  { name: 'DOC', icon: 'DOC', available: true },
  { name: 'DOCX', icon: 'DOCX', available: true },
  { name: 'EPUB', icon: 'EPUB', available: true },
  { name: 'TXT', icon: 'TXT', available: true },
  { name: 'FB2', icon: 'FB2', available: true },
];

const comingSoonFormats = [
  { name: 'MOBI', icon: 'MOBI' },
  { name: 'AZW3', icon: 'AZW3' },
];

export default function FormatsRoadmap() {
  const { t } = useTranslation('landing');

  return (
    <section id="collections" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full opacity-10 -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle, hsl(265 85% 60% / 0.2) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="text-white">{t('formatsAnd')}</span>{' '}
            <span className="text-gradient">{t('roadmap')}</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('formatsSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Currently Supported */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="p-8 rounded-2xl bg-gradient-card border border-white/5">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {t('currentlySupported')}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {supportedFormats.map((format, index) => (
                  <motion.div
                    key={format.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <div className="flex flex-col items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-green-500/30 transition-all">
                      <FileText className="w-8 h-8 text-green-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white">
                        {format.name}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Coming Soon */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="p-8 rounded-2xl bg-gradient-card border border-white/5">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {t('comingSoon')}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {comingSoonFormats.map((format, index) => (
                  <motion.div
                    key={format.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="group"
                  >
                    <div className="flex flex-col items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/30 transition-all">
                      <FileText className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white">
                        {format.name}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400 text-center">
                  {t('formatRequestText')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
