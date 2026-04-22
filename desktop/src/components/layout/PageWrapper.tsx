import { motion } from 'framer-motion'
import { Topbar } from './Topbar'

interface PageWrapperProps {
  title: string
  children: React.ReactNode
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export function PageWrapper({ title, children }: PageWrapperProps) {
  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      <Topbar title={title} />
      <motion.main
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.15 }}
        className="flex-1 overflow-y-auto p-5"
      >
        {children}
      </motion.main>
    </div>
  )
}
