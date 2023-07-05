import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	const [num, updateNum] = useState(100)
	// @ts-ignore
	window.updateNum = updateNum
	return <div onClick={() => updateNum(3)}>{num}</div>
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
