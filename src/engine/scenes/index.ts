import type { SceneDef } from "../types";
import { bubbleKeys } from "./bubbleKeys";
import { glowStaff } from "./glowStaff";
import { fallingBars } from "./fallingBars";

/**
 * 玩法注册表。新增玩法 = 新建一个文件(导出 SceneDef) + 在下面加一行。
 * 工作台的参数面板、配置校验、说明页都从这里自动生成，不需要改 UI。
 */
export const SCENES: SceneDef[] = [bubbleKeys, glowStaff, fallingBars];
export const getScene = (id: string) => SCENES.find((s) => s.id === id) ?? SCENES[0];
