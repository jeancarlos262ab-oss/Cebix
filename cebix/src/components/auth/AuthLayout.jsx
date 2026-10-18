import { useContext, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthShellContext } from "./AuthShellContext";

export default function AuthLayout({ title, subtitle, activeTab, children }) {
  const shell = useContext(AuthShellContext);

  useLayoutEffect(() => {
    shell?.setShowTabs(Boolean(activeTab));
  }, [shell, activeTab]);

  const body = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="mb-7">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="auth-muted mt-1.5 text-sm">{subtitle}</p>
        </div>

        {children}
      </motion.div>
    </AnimatePresence>
  );

  
  
  
  
  return body;
}