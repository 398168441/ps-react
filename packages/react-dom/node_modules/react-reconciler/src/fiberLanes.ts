import {FiberRootNode} from './fiber'
export type Lane = number // 作为 update 的优先级
export type Lanes = number // 代表一个优先级的集合

/**
 * 为什么要用二进制来表示优先级呢？
 * React的并发更新 会选出一批优先级 也就是选出多个优先级
 * 如果优先级用1,2,3,4,5数字来表示 然后选出多个时 用一个 Set 或者Array 来存放 -- 明显这种方式更占内存 而且没有二进制灵活
 * 用二进制的话 可以通过 mergeLanes 的按位或 | 合并两个二进制
 */
// 对应的Lane越小 优先级越高 但是0是没有优先级
export const SyncLane = /*   */ 0b0001
export const NoLanes = /*    */ 0b0000
export const NoLane = /*     */ 0b0000

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB
}

/**
 * 获取优先级
 * 不同的事件产生的更新的优先级是不同的
 */
export function requestUpdateLane() {
	//  todo 根据不同上下文 返回不同的优先级
	return SyncLane
}

/**
 * 实现一种机制选出一批Lane
 * 直接获取优先级最高的Lane
 * 比如传进来的Lanes是 0b0011 要返回的则是最小(最靠右的)的Lane 0b0001
 * 比如传进来的Lanes是 0b0110 要返回的则是最小(最靠右的)的Lane 0b0010
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes
}

//	从root的pendingLanes即未被消费的Lanes 中移除本次消费的lane
export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane
}
