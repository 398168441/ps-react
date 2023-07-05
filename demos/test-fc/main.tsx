import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	const [num, updateNum] = useState(100)
	// @ts-ignore
	window.updateNum = updateNum
	return num === 3 ? <Child /> : <div>{num}</div>
}

const Child = () => {
	return (
		<div>
			<span>ps-react</span>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)
