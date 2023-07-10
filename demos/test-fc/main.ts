import {
	unstable_ImmediatePriority as ImmediatePriority, // 同步优先级
	unstable_UserBlockingPriority as UserBlockingPriority, // 用户操作 比如点击事件
	unstable_NormalPriority as NormalPriority, // 一般优先级
	unstable_LowPriority as LowPriority, //	低优先级
	unstable_IdlePriority as IdlePriority, //	空闲优先级
	unstable_scheduleCallback as scheduleCallback, // 调度回调函数
	unstable_shouldYield as shouldYield, //时间切片 时间是否用尽
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler'

import './index.css'
const root = document.querySelector('#root')
const button = document.querySelector('button')

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority

interface Work {
	count: number // 类比React中组件数量
	priority: Priority
}

// 交互产生Work 会插入到workList任务队列
const workList: Work[] = []
//	保存一个前一次任务的优先级 默认空闲优先级
let prevPriority: Priority = IdlePriority
//	保存一下当前调度的回调函数
let curCallback: CallbackNode | null = null

;[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
	(priority) => {
		const btn = document.createElement('button')
		root?.appendChild(btn)
		btn.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority]
		btn.onclick = () => {
			workList.unshift({
				count: 20,
				priority: priority as Priority
			})
			schedule()
		}
	}
)

// 调度方法
function schedule() {
	const cbNode = getFirstCallbackNode()
	//	一、找出优先级最高的work，数字越小优先级越高 1-5
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0]

	//	二、 策略逻辑
	if (!curWork) {
		curCallback = null
		cbNode && cancelCallback(cbNode)
		return
	}

	const {priority: curPriority} = curWork

	if (curPriority === prevPriority) {
		// 相同优先级 直接不执行新的调度
		return
	}
	// 更高优先级来了 取消之前的work
	cbNode && cancelCallback(cbNode)

	//	三、调度宏任务
	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork))
}

//  3、微任务调度结束，进入render阶段
//  4、render阶段结束，进入commit阶段
// 如果过期scheduleCallback会往perform传一个该work是否过期了
function perform(work: Work, didTimeout?: boolean) {
	// 注意：如果这里work的任务太多，work任务工作量太大，这里的JS执行会很久 就会造成堵塞
	/**
	 * 哪些因素会中止
	 * 1.work.priority
	 * 2.饥饿问题（优先级很低，一直竞争不过其他高优先级，一直得不到执行，优先级就会越来越高，直到过期，被同步执行）
	 * 3.时间切片
	 */
	const needSync = work.priority === ImmediatePriority || didTimeout
	while ((needSync || !shouldYield()) && work.count) {
		// 需要同步执行 || 时间没有用尽 && work没完成
		work.count--
		// 执行具体的操作
		insertSpan(work.priority)
	}

	// 中断执行 ||	执行完 --把work从workList中移除
	prevPriority = work.priority
	if (!work.count) {
		const workIndex = workList.indexOf(work)
		workList.splice(workIndex, 1)
		//	重置prevPriority
		prevPriority = IdlePriority
	}
	// 5、commit阶段结束，继续调度微任务-循环调度
	const prevCallback = curCallback
	schedule()
	const newCallback = curCallback
	//
	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work)
	}
}

//  宿主的API
function insertSpan(content) {
	const span = document.createElement('span')
	span.innerText = content
	span.className = `pri-${content}`
	doSomeBuzyWork(100000000)
	root?.appendChild(span)
}

function doSomeBuzyWork(len: number) {
	let result = 0
	while (len--) {
		result += len
	}
}
