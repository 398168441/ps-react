/**
 * 同步任务队列
 */

// 定义一个同步回调函数集合
let syncQueue: ((...args: any) => void)[] | null = null

// 标记是否正在冲洗
let isFlushingSyncQueue = false

//  1、调度 保存调度同步的回调函数
export function scheduleSyncCallback(callback: (...args: any) => void) {
	//
	if (syncQueue === null) {
		syncQueue = [callback]
	} else {
		syncQueue.push(callback)
	}
}

//  2、执行 冲洗(执行)回调函数
export function flushSyncCallbacks() {
	//  因为isFlushingSyncQueue标记 多次调用只会执行一次syncQueue遍历
	if (!isFlushingSyncQueue && syncQueue) {
		//  没有冲洗 且 syncQueue有回调函数 先标记 再开始冲洗
		isFlushingSyncQueue = true
		try {
			syncQueue.forEach((callback) => callback())
		} catch (e) {
			if (__DEV__) {
				console.warn('flushSyncCallbacks报错', e)
			}
		} finally {
			isFlushingSyncQueue = false
			syncQueue = null
		}
	}
}
