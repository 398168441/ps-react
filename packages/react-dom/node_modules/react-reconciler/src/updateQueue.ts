import {Dispatch} from 'react/src/currentDispatcher'
import {Action} from 'shared/ReactTypes'
import {isSubsetOfLanes, Lane} from './fiberLanes'

export interface Update<State> {
	action: Action<State>
	lane: Lane // 代表这个更新的优先级
	next: Update<any> | null
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
	dispatch: Dispatch<State> | null
}

//  创建Update
export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	}
}

//  创建updateQueue
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>
}

/**
 * 往 updateQueue 里增加 update
 * 每次新增Update 不会覆盖原来的
 * 而是形成一条通过next链接的环装链表
 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	//	每次添加进来的update 会和上一次插入的Update 通过next 形成一条环状链表 a->b->c->a
	const pending = updateQueue.shared.pending
	if (pending === null) {
		//	插入第一个update 则目前只有一个update 自己和自己形成环状链表 a->a->a
		update.next = update
	} else {
		// pending是最后一个update 它的next就是第一个
		update.next = pending.next
		pending.next = update
	}

	//	pending始终指向链表的最后一个update
	updateQueue.shared.pending = update
}

//  消费update
/**
 * 1.baseState是本次更新参与计算的初始state，memoizedState是上次更新计算的最终state
 * 2.如果本次更新没有update被跳过，则下次更新开始时baseState === memoizedState
 * 3.如果本次更新有update被跳过，则本次更新计算出的memoizedState为「考虑优先级」情况下计算的结果，baseState为「最后一个没被跳过的update计算后的结果」，下次更新开始时baseState !== memoizedState
 * 4.本次更新「被跳过的update及其后面的所有update」都会被保存在baseQueue中参与下次state计算
 * 5.本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State
	baseState: State
	baseQueue: Update<State> | null
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	}
	/**
	 * 当前update是环状链表 c->a->b->c
	 * pending -> a pending指向第一个update
	 */
	if (pendingUpdate !== null) {
		const first = pendingUpdate.next
		let pending = pendingUpdate.next as Update<any>

		let newBaseState = baseState
		let newBaseQueueFirst: Update<State> | null = null
		let newBaseQueueLast: Update<State> | null = null
		let newState = baseState

		do {
			// 本次更新的Lane和update的lane一致 才计算
			const updateLane = pending.lane
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				//	优先级不够 被跳过
				const clone = createUpdate(pending.action, pending.lane)
				/**
				 * 判断这个update是不是第一个被跳过的update
				 * 总之把跳过的update 用指针把该update串联成一个单项链表
				 */
				if (newBaseQueueFirst === null) {
					//	是第一个
					newBaseQueueFirst = clone
					newBaseQueueLast = clone
					newBaseState = newState
				} else {
					//	不是第一个
					;(newBaseQueueLast as Update<State>).next = clone
					newBaseQueueLast = clone
				}
			} else {
				//	优先级足够
				/**
				 * 先判断是否有被跳过的update
				 * 有的话参与计算的update则会被保存进baseQueue
				 * 并且把该update的Lane置为NoLane
				 */
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, pending.lane)
					;(newBaseQueueLast as Update<State>).next = clone
					newBaseQueueLast = clone
				}
				const action = pending.action
				if (action instanceof Function) {
					// baseState 1 update (x) => 4x -> memoizedState 4
					newState = action(baseState)
				} else {
					// baseState 1 update 2 -> memoizedState 2
					newState = action
				}
			}
			pending = pending.next as Update<any>
		} while (pending !== first)

		/**
		 * 	判断是否有update被跳过
		 * 	没有的话 newState赋值给newBaseState
		 *  由的话， 把跳过的单向链表合成环状链表
		 */
		if (newBaseQueueLast === null) {
			// 没有跳过的update
			newBaseState = newState
		} else {
			newBaseQueueLast.next = newBaseQueueFirst
		}

		result.memoizedState = newState
		result.baseQueue = newBaseQueueLast
		result.baseState = newBaseState
	}

	return result
}
