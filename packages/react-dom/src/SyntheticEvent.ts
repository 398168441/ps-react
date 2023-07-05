/**
 * 合成事件
 * 这个文件存放所有和react-dom相关的事件系统
 */

import {Container} from 'hostConfig'
import {Props} from 'shared/ReactTypes'

export const elementPropsKey = '__props'

type EventCallback = (e: Event) => void

//  捕获和冒泡都是模拟实现的，所以阻止冒泡和阻止默认事件 也要模拟实现
interface SyntheticEvent extends Event {
	__stopPropagation: boolean
}

interface Paths {
	capture: EventCallback[]
	bubble: EventCallback[]
}

export interface DOMElement extends Element {
	[elementPropsKey]: Props
}

// 支持的事件
// 先实现下 click 事件
const validEventTypeList = ['click']

// dom[xxx] = reactElement props
/**
 * 在哪里调用
 * 1、创建dom时
 * 2、更新dom时
 */
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props
}

// 定义一个初始化方法
export function initEvent(container: Container, eventType: string) {
	// 1、先判断是否是我们支持的时间类型
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件')
		return
	}

	if (__DEV__) {
		console.log('初始化事件：', eventType)
	}

	// 2、通过事件委托(代理) 在container上监听事件 再通过dispatchEvent方法 触发从targetElement收集到container的所有事件
	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e)
	})
}

//  创建合成事件对象
function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent
	syntheticEvent.__stopPropagation = false
	const originStopPropagation = e.stopPropagation

	// 定义下合成事件对象的stopPropagation事件
	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true
		// 原生stopPropagation存在则执行下
		if (originStopPropagation) {
			originStopPropagation()
		}
	}

	return syntheticEvent
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	const targetElement = e.target
	if (!targetElement) {
		console.warn('事件不存在target', e)
		return
	}
	// 1、收集沿途的事件
	const {capture, bubble} = collectPaths(
		targetElement as DOMElement,
		container,
		eventType
	)
	// 2、构建合成事件
	const se = createSyntheticEvent(e)
	// 3、捕获阶段 遍历capture
	triggerEventFlow(capture, se)
	// 4、冒泡阶段 遍历bubble
	if (!se.__stopPropagation) {
		// 未执行 stopPropagation 事件 才继续冒泡阶段
		triggerEventFlow(bubble, se)
	}
}

function triggerEventFlow(
	eventCallbackArr: EventCallback[],
	se: SyntheticEvent
) {
	for (let i = 0; i < eventCallbackArr.length; i++) {
		const callback = eventCallbackArr[i]
		callback.call(null, se)
		//  如果 合成事件对象的 __stopPropagation === true 则停止循环
		if (se.__stopPropagation) {
			break
		}
	}
}

// 获取事件回调函数名称
function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		//  第0项对应捕获阶段 第1项对应冒泡阶段
		click: ['onClickCapture', 'onClick']
	}[eventType]
}

//  收集事件
function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	// 1、定义收集结果
	const paths: Paths = {
		capture: [],
		bubble: []
	}

	// 2、遍历收集 终止条件 目标节点===container
	while (targetElement && targetElement !== container) {
		// 收集
		// 先拿到element上的props
		const elementProps = targetElement[elementPropsKey]
		if (elementProps) {
			// 需要一个映射 原生事件 click -> onClick onClickCapture
			const callbackNameList = getEventCallbackNameFromEventType(eventType)
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName]
					/**
					 * div 包含 onClick onClickCapture
					 *      p 包含 onClick onClickCapture
					 *          span【targetElement】 包含 onClick onClickCapture
					 * 1、收集开始 先是targetElement 即span进入while循环 callbackNameList === ['onClickCapture', 'onClick']
					 * 2、第0项 onClickCapture unshift到capture===['(span)onClickCapture'], 第1项 onClick push到bubble===['(span)onClick']
					 * 3、targetElment冒泡到p，及p进入while循环 callbackNameList === ['onClickCapture', 'onClick']
					 * 4、第0项 onClickCapture unshift到capture===['(p)onClickCapture','(span)onClickCapture'], 第1项 onClick push到bubble===['(span)onClick', ''(p)onClick'']
					 * 5、targetElment冒泡到div(container)，及div进入while循环 callbackNameList === ['onClickCapture', 'onClick']
					 * 6、第0项 onClickCapture unshift到capture===['(div)onClickCapture','(p)onClickCapture','(span)onClickCapture'], 第1项 onClick push到bubble===['(span)onClick', '(p)onClick', '(div)onClick']
					 * 7、最终得到的capture === ['(div)onClickCapture','(p)onClickCapture','(span)onClickCapture']
					 * 8、最终得到的bubble === ['(span)onClick', '(p)onClick', '(div)onClick']
					 * 9、遍历capture执行事件时 从div->p->span 即模拟捕获
					 * 10、遍历bubble执行事件时 从span->p->div 即模拟冒泡
					 */
					if (eventCallback) {
						// eventCallBack存在时 才去插入EventCallback数组
						if (i === 0) {
							paths.capture.unshift(eventCallback)
						} else {
							paths.bubble.push(eventCallback)
						}
					}
				})
			}
		}
		targetElement = targetElement.parentNode as DOMElement
	}

	return paths
}
