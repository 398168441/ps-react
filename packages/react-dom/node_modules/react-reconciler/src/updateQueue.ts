import {Dispatch} from 'react/src/currentDispatcher'
import {Action} from 'shared/ReactTypes'

export interface Update<State> {
	action: Action<State>
	next: Update<any> | null
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null
	}
	dispatch: Dispatch<State> | null
}

//  创建Update
export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action,
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
	//	每次添加进来的update 会和上一次插入的Update 通过next 形成一条环装链表 a->b->c->a
	const pending = updateQueue.shared.pending
	if (pending === null) {
		//	插入第一个update 则目前只有一个update 自己和自己形成环装链表 a->a->a
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
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): {memoizedState: State} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	}
	if (pendingUpdate !== null) {
		const action = pendingUpdate.action
		if (action instanceof Function) {
			// baseState 1 update (x) => 4x -> memoizedState 4
			result.memoizedState = action(baseState)
		} else {
			// baseState 1 update 2 -> memoizedState 2
			result.memoizedState = action
		}
	}
	return result
}
