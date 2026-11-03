import {notFound} from 'next/navigation';
import WorldCapture from '../../WorldCapture';
export default function CapturePage({params}:{params:{scene:string;time:string}}){
 const hours:Record<string,number>={morning:6.5,day:12,evening:18,night:0};
 if(!(params.time in hours))notFound();
 return <WorldCapture hour={hours[params.time]}/>;
}
