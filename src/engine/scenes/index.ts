/**
 * 落款：Grok（xAI）· 2026-11-06
 * 改动：注册 ball-sort，加在列表末尾。未知玩法仍回落到第一个（泡泡琴键）。
 *       不要把分球机挪到第一个，除非同时改 getScene 的回落。
 * 下一手：新玩法继续加在末尾。不要删泡泡琴键、五线谱流光、下落音条。
 * 再改本文件：在本注释下面追加落款，不要删上面这段。
 */
import type { SceneDef } from "../types";
import { bubbleKeys } from "./bubbleKeys";
import { glowStaff } from "./glowStaff";
import { fallingBars } from "./fallingBars";
import { ballSort } from "./ballSort";

/**
 * 玩法注册表。新增玩法 = 新建一个文件(导出 SceneDef) + 在下面加一行。
 * 参数面板、配置校验、说明页都从这里生成。
 * 选项类参数（select）从 2026-11-06 起会画在面板上，见 Panels.tsx 的落款。
 */
export const SCENES: SceneDef[] = [bubbleKeys, glowStaff, fallingBars, ballSort];
export const getScene = (id: string) => SCENES.find((s) => s.id === id) ?? SCENES[0];
