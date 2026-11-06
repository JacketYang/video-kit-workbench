import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectConfig } from "./engine/types";
import { TEMPLATES, normalizeConfig } from "./engine/config";

// 作品存在浏览器 localStorage 里。换设备/清缓存会丢，所以重要作品请「导出 JSON」备份。
const KEY = "vk.projects.v1";
const CUR = "vk.current.v1";

export interface Saved {
  id: string;
  updatedAt: number;
  config: ProjectConfig;
}
const uid = () => Math.random().toString(36).slice(2, 9);

function load(): Saved[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) return raw.map((s) => ({ id: String(s.id ?? uid()), updatedAt: Number(s.updatedAt) || Date.now(), config: normalizeConfig(s.config).config }));
  } catch {
    /* ignore */
  }
  return [];
}

export function useProjects() {
  const [projects, setProjects] = useState<Saved[]>(() => {
    const l = load();
    return l.length ? l : [{ id: uid(), updatedAt: Date.now(), config: TEMPLATES[0].config }];
  });
  const [currentId, setCurrentId] = useState<string>(() => {
    const c = localStorage.getItem(CUR);
    return c ?? "";
  });
  const cur = projects.find((p) => p.id === currentId) ?? projects[0];
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(projects));
        localStorage.setItem(CUR, cur.id);
      } catch {
        /* 存储满了就算了 */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [projects, cur.id]);

  const setCfg = useCallback(
    (fn: (c: ProjectConfig) => ProjectConfig) => {
      setProjects((ps) => ps.map((p) => (p.id === cur.id ? { ...p, updatedAt: Date.now(), config: fn(p.config) } : p)));
    },
    [cur.id],
  );
  const create = useCallback((config: ProjectConfig) => {
    const id = uid();
    setProjects((ps) => [{ id, updatedAt: Date.now(), config }, ...ps]);
    setCurrentId(id);
    return id;
  }, []);
  const remove = useCallback(
    (id: string) => {
      setProjects((ps) => {
        const rest = ps.filter((p) => p.id !== id);
        return rest.length ? rest : [{ id: uid(), updatedAt: Date.now(), config: TEMPLATES[0].config }];
      });
      if (id === cur.id) setCurrentId("");
    },
    [cur.id],
  );
  const duplicate = useCallback((id: string) => {
    setProjects((ps) => {
      const s = ps.find((p) => p.id === id);
      return s ? [{ id: uid(), updatedAt: Date.now(), config: { ...s.config, name: s.config.name + " 副本" } }, ...ps] : ps;
    });
  }, []);

  return { projects, cur, setCfg, create, remove, duplicate, open: setCurrentId };
}
